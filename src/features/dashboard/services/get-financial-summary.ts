import 'server-only'
import { mlGet } from './ml-client'
import {
  ML_USER_ID,
  computeOrderLineMetrics,
  bodegaFeeFor,
  flexCourierFeeFor,
  isFlex,
  FALLBACK_PRODUCT_COST_PER_UNIT_COP,
  TAX_WITHHOLDING_RATE,
} from '../constants'
import { getListingMap, type ListingInfo } from '@/features/inventario/services/get-product-catalog'
import { getProductCostPerUnit } from '@/features/inventario/services/get-product-costs'
import { getShipmentCost } from './get-shipment-costs'
import { getRealNet } from '@/features/finanzas/services/get-real-net'
import { syncMlPayments } from '@/features/finanzas/services/sync-ml-payments'
import { getBogotaWeekStart, getCurrentWeekRange } from '../lib/bogota-week'
import type { FinancialSummary, PeriodMetrics } from '../types'

interface MlOrderItem {
  item: { id: string; title: string }
  quantity: number
  unit_price: number
  /** ML's own per-unit commission. Only used now when a payment hasn't synced yet. */
  sale_fee?: number
}

interface MlOrder {
  id: number
  status: string
  total_amount: number
  order_items: MlOrderItem[]
  shipping?: { id: number } | null
}

interface MlOrdersSearchResponse {
  paging: { total: number; offset: number; limit: number }
  results: MlOrder[]
}

interface CostInputs {
  listingMap: Map<string, ListingInfo>
  productCosts: Map<string, number>
}

/**
 * Economics of a period, read from what ML actually paid.
 *
 * The revenue side is no longer computed. Commission, shipping and withholdings
 * come from the payment ML issued for each order (`ml_payments`, mirrored from
 * api.mercadopago.com). Only the costs ML cannot know are still ours to add:
 * product, bodega, courier.
 *
 * Why this matters beyond precision: the old model charged an estimated 1,5%
 * withholding to EVERY sale. Measured over 1.209 real sales (2026-08-18),
 * **4 in 10 pay no withholding at all** — the estimate billed $1.464.097 a year
 * where the real figure was $1.063.362. Profit was understated, not overstated.
 *
 * Orders whose payment hasn't synced yet (a sale from minutes ago) fall back to
 * the old computation and are counted in `provisionalOrderCount` so the UI can
 * say so. They are never silently mixed in as if they were exact.
 */
async function fetchPeriodMetrics(
  from: Date,
  to: Date,
  periodLabel: string,
  { listingMap, productCosts }: CostInputs
): Promise<PeriodMetrics> {
  const fmt = (d: Date) => d.toISOString().slice(0, 19) + '.000-00:00'

  const query = new URLSearchParams({
    seller: ML_USER_ID,
    'order.date_created.from': fmt(from),
    'order.date_created.to': fmt(to),
    sort: 'date_desc',
    limit: '50',
  })

  const data = await mlGet<MlOrdersSearchResponse>(`/orders/search?${query.toString()}`)
  const paidOrders = data.results.filter((o) => o.status === 'paid')

  // Per-package dispatch still needs the shipment: only it knows whether the
  // package went out Flex or agencia, which is what the bodega gets paid for.
  const packageCosts = await Promise.all(
    paidOrders.map((o) => (o.shipping?.id ? getShipmentCost(o.shipping.id) : null))
  )

  const real = await getRealNet(paidOrders.map((o) => String(o.id)), from, to)

  let unitsSold = 0
  let productCost = 0
  let bodegaFee = 0
  let flexCourierFee = 0
  let flexOrderCount = 0
  let agenciaOrderCount = 0

  // Only for orders still missing their payment.
  let provisionalOrderCount = 0
  let provisionalGross = 0
  let provisionalCommission = 0
  let provisionalShipping = 0
  let provisionalBonus = 0
  let provisionalTax = 0

  paidOrders.forEach((order, i) => {
    const hasPayment = real.ordersWithPayment.has(String(order.id))
    if (!hasPayment) provisionalOrderCount += 1

    for (const line of order.order_items) {
      const listing = listingMap.get(line.item.id)
      const unitsPerSale = listing?.unitsPerSale ?? 1
      const costPerUnit = listing
        ? productCosts.get(listing.productId) ?? FALLBACK_PRODUCT_COST_PER_UNIT_COP
        : FALLBACK_PRODUCT_COST_PER_UNIT_COP

      const m = computeOrderLineMetrics(line.quantity, line.unit_price, unitsPerSale, costPerUnit, line.sale_fee)
      productCost += m.productCost
      unitsSold += line.quantity * unitsPerSale

      if (!hasPayment) {
        provisionalGross += m.grossSales
        provisionalCommission += m.mlCommission
      }
    }

    // Charged once per package, never per line item.
    const pkg = packageCosts[i]
    if (pkg) {
      bodegaFee += bodegaFeeFor(pkg.logisticType)
      flexCourierFee += flexCourierFeeFor(pkg.logisticType)
      if (isFlex(pkg.logisticType)) flexOrderCount += 1
      else agenciaOrderCount += 1

      if (!hasPayment) {
        provisionalShipping += pkg.shippingCharge
        provisionalBonus += pkg.shippingBonus
      }
    }
  })

  provisionalTax = provisionalGross * TAX_WITHHOLDING_RATE

  const grossSales = real.grossSales + provisionalGross
  const mlCommission = real.mlCommission + provisionalCommission
  const shippingCost = real.shippingCost + provisionalShipping
  const shippingBonus = real.shippingBonus + provisionalBonus
  const taxWithholding = real.taxWithholding + provisionalTax

  // What ML left us, plus the Flex bonus, minus the costs only we know about.
  const netFromMl =
    real.netFromMl + (provisionalGross - provisionalCommission - provisionalShipping - provisionalTax)

  const netProfit = netFromMl + shippingBonus - productCost - bodegaFee - flexCourierFee
  const marginRate = grossSales > 0 ? netProfit / grossSales : 0

  return {
    periodLabel,
    orderCount: paidOrders.length,
    unitsSold,
    grossSales,
    mlCommission,
    shippingCost,
    shippingBonus,
    productCost,
    bodegaFee,
    flexCourierFee,
    flexOrderCount,
    agenciaOrderCount,
    taxWithholding,
    otherMlCharges: real.otherMlCharges,
    provisionalOrderCount,
    netProfit,
    marginRate,
  }
}

/**
 * Calendar week (Monday-Sunday, Bogotá local), not a rolling 7-day window —
 * confirmed by the user 2026-08-15: "semanas" means the actual week.
 *
 * The previous period is the COMPLETE prior week: it's no longer used for a
 * percentage comparison (those per-line badges were removed 2026-08-18 —
 * this card states what happened this week, it isn't a trend widget), only
 * to show last week's totals as reference on the goal card.
 */
export async function getFinancialSummary(): Promise<FinancialSummary> {
  const { from, to } = getCurrentWeekRange()
  const previousFrom = new Date(getBogotaWeekStart(new Date(from.getTime() - 24 * 60 * 60 * 1000)))

  // Pull any payments issued since the last load. Deliberately non-fatal: if
  // Mercado Pago is down, the dashboard still renders with what's stored and
  // the affected orders simply show as provisional. A sync failure must never
  // be the reason she can't see her week.
  try {
    await syncMlPayments()
  } catch (e) {
    console.warn('[dashboard] No se pudieron sincronizar los pagos de Mercado Pago:', e)
  }

  const [listingMap, productCosts] = await Promise.all([getListingMap(), getProductCostPerUnit()])
  const inputs: CostInputs = { listingMap, productCosts }

  const [current, previousPeriod] = await Promise.all([
    fetchPeriodMetrics(from, to, 'Esta semana (lun-dom)', inputs),
    fetchPeriodMetrics(previousFrom, from, 'Semana pasada', inputs),
  ])

  return { ...current, previousPeriod }
}
