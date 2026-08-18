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
import { getBogotaWeekStart, getCurrentWeekRange } from '../lib/bogota-week'
import type { FinancialSummary, PeriodMetrics } from '../types'

interface MlOrderItem {
  item: { id: string; title: string }
  quantity: number
  unit_price: number
  /** ML's own per-unit commission for this listing — the real rate, not a flat 11.5%. */
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

  // One package per order: its real shipping charge and how it was dispatched.
  const packageCosts = await Promise.all(
    paidOrders.map((o) => (o.shipping?.id ? getShipmentCost(o.shipping.id) : null))
  )

  let grossSales = 0
  let unitsSold = 0
  let shippingCost = 0
  let shippingBonus = 0
  let productCost = 0
  let bodegaFee = 0
  let flexCourierFee = 0
  let flexOrderCount = 0
  let agenciaOrderCount = 0
  let mlCommission = 0

  paidOrders.forEach((order, i) => {
    for (const line of order.order_items) {
      const listing = listingMap.get(line.item.id)
      const unitsPerSale = listing?.unitsPerSale ?? 1
      const costPerUnit = listing
        ? productCosts.get(listing.productId) ?? FALLBACK_PRODUCT_COST_PER_UNIT_COP
        : FALLBACK_PRODUCT_COST_PER_UNIT_COP

      const m = computeOrderLineMetrics(line.quantity, line.unit_price, unitsPerSale, costPerUnit, line.sale_fee)
      grossSales += m.grossSales
      mlCommission += m.mlCommission
      productCost += m.productCost
      unitsSold += line.quantity * unitsPerSale
    }

    // Charged once per package, not per unit or per product line.
    const pkg = packageCosts[i]
    if (pkg) {
      shippingCost += pkg.shippingCharge
      shippingBonus += pkg.shippingBonus
      bodegaFee += bodegaFeeFor(pkg.logisticType)
      flexCourierFee += flexCourierFeeFor(pkg.logisticType)
      if (isFlex(pkg.logisticType)) flexOrderCount += 1
      else agenciaOrderCount += 1
    }
  })

  const taxWithholding = grossSales * TAX_WITHHOLDING_RATE
  const netProfit =
    grossSales -
    mlCommission -
    shippingCost +
    shippingBonus -
    productCost -
    bodegaFee -
    flexCourierFee -
    taxWithholding
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

  const [listingMap, productCosts] = await Promise.all([getListingMap(), getProductCostPerUnit()])
  const inputs: CostInputs = { listingMap, productCosts }

  const [current, previousPeriod] = await Promise.all([
    fetchPeriodMetrics(from, to, 'Esta semana (lun-dom)', inputs),
    fetchPeriodMetrics(previousFrom, from, 'Semana pasada', inputs),
  ])

  return { ...current, previousPeriod }
}
