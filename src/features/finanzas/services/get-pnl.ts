import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { mlGet } from '@/features/dashboard/services/ml-client'
import {
  ML_USER_ID,
  BODEGA_FEE_FLEX_COP,
  FULFILLMENT_FEE_AGENCIA_COP,
  FLEX_COURIER_FEE_COP,
  FALLBACK_PRODUCT_COST_PER_UNIT_COP,
} from '@/features/dashboard/constants'
import { getListingMap } from '@/features/inventario/services/get-product-catalog'
import { getProductCostPerUnit } from '@/features/inventario/services/get-product-costs'
import { HAPPY_BUY_COLLECTOR_ID, FLEX_BONUS_DESCRIPTION } from './parse-payment'
import { getMonthlyAds } from './get-monthly-ads'

export interface PnlMonth {
  key: string
  label: string
  /** El mes en curso lleva días incompletos: compararlo de igual a igual engaña. */
  isPartial: boolean
  grossSales: number
  orderCount: number
  mlCommission: number
  shippingCost: number
  taxWithholding: number
  /**
   * Cargos que ML lista en el pago pero no descuenta de él. Positivo = descontó
   * de más; negativo = de menos (es lo habitual, y queda a favor). Sin esta
   * fila la columna no suma y la tabla parece equivocada.
   */
  otherMlCharges: number
  shippingBonus: number
  productCost: number
  bodegaFee: number
  courierFee: number
  expenses: number
  ads: number
  netProfit: number
  marginRate: number
}

const MONTHS_SHOWN = 4

/** 'flex' | 'agencia' | 'full' a partir de los cargos que ML aplicó al pago. */
type Canal = 'flex' | 'agencia' | 'full'

/**
 * Canal de despacho deducido de los cargos del propio pago.
 *
 * Evita pedir `/shipments/{id}` cientos de veces para reconstruir meses de
 * historia. `shp_fulfillment` = Full (ML despacha, nadie cobra por paquete);
 * cualquier otro `shp_` = agencia; sin cargo de envío = Flex, que es donde ML
 * en vez de cobrar bonifica.
 */
function canalDe(charges: unknown): Canal {
  const raw = JSON.stringify(charges ?? '')
  if (raw.includes('shp_fulfillment')) return 'full'
  if (raw.includes('shp_')) return 'agencia'
  return 'flex'
}

function monthKeys(now: Date): string[] {
  const keys: string[] = []
  for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

interface MlOrderItem {
  item: { id: string }
  quantity: number
}

interface MlOrder {
  id: number
  status: string
  date_created: string
  order_items: MlOrderItem[]
}

interface MlOrdersSearch {
  paging: { total: number }
  results: MlOrder[]
}

/** Costo de producto por mes. Requiere las órdenes: solo ellas dicen qué se vendió. */
async function productCostByMonth(months: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>(months.map((m) => [m, 0]))

  const [listingMap, productCosts] = await Promise.all([getListingMap(), getProductCostPerUnit()])

  const first = new Date(`${months[0]}-01T00:00:00.000-05:00`)
  const fmt = (d: Date) => d.toISOString().slice(0, 19) + '.000-00:00'
  const PAGE = 50

  let offset = 0
  while (true) {
    const query = new URLSearchParams({
      seller: ML_USER_ID,
      'order.date_created.from': fmt(first),
      'order.date_created.to': fmt(new Date()),
      sort: 'date_desc',
      limit: String(PAGE),
      offset: String(offset),
    })

    const page = await mlGet<MlOrdersSearch>(`/orders/search?${query.toString()}`)
    for (const order of page.results ?? []) {
      if (order.status !== 'paid') continue
      const month = order.date_created.slice(0, 7)
      if (!result.has(month)) continue

      let cost = 0
      for (const line of order.order_items) {
        const listing = listingMap.get(line.item.id)
        const unitsPerSale = listing?.unitsPerSale ?? 1
        const perUnit = listing
          ? productCosts.get(listing.productId) ?? FALLBACK_PRODUCT_COST_PER_UNIT_COP
          : FALLBACK_PRODUCT_COST_PER_UNIT_COP
        cost += perUnit * unitsPerSale * line.quantity
      }
      result.set(month, (result.get(month) ?? 0) + cost)
    }

    offset += PAGE
    if (offset >= (page.paging?.total ?? 0)) break
  }

  return result
}

/**
 * Estado de resultados por mes.
 *
 * Se agrupa por `date_approved` — **cuándo se vendió**, no cuándo entra la
 * plata. Una venta del 18 de agosto es utilidad de agosto aunque ML la deposite
 * el 8 de septiembre; eso último lo responde el flujo de caja. Son dos números
 * correctos que no coinciden, y la UI tiene que decirlo.
 */
export async function getPnl(): Promise<PnlMonth[]> {
  const supabase = createAdminClient()
  const now = new Date()
  const months = monthKeys(now)
  const from = `${months[0]}-01T00:00:00.000-05:00`

  const [{ data: sales }, { data: bonuses }, { data: gastos }, ads, productCosts] = await Promise.all([
    supabase
      .from('ml_payments')
      .select('date_approved, transaction_amount, net_received_amount, meli_fee, shipping_charge, tax_withholding, charges')
      .eq('collector_id', HAPPY_BUY_COLLECTOR_ID)
      .eq('status', 'approved')
      .eq('operation_type', 'regular_payment')
      .not('order_id', 'is', null)
      .gte('date_approved', from),
    supabase
      .from('ml_payments')
      .select('date_approved, transaction_amount')
      .eq('status', 'approved')
      .eq('description', FLEX_BONUS_DESCRIPTION)
      .gte('date_approved', from),
    supabase.from('expenses').select('spent_on, amount').gte('spent_on', from.slice(0, 10)),
    getMonthlyAds(months),
    productCostByMonth(months),
  ])

  const blank = () => ({
    grossSales: 0,
    orderCount: 0,
    mlCommission: 0,
    shippingCost: 0,
    taxWithholding: 0,
    shippingBonus: 0,
    netFromMl: 0,
    bodegaFee: 0,
    courierFee: 0,
    expenses: 0,
  })

  const acc = new Map(months.map((m) => [m, blank()]))

  for (const row of sales ?? []) {
    if (!row.date_approved) continue
    const m = acc.get(row.date_approved.slice(0, 7))
    if (!m) continue

    m.grossSales += Number(row.transaction_amount)
    m.netFromMl += Number(row.net_received_amount)
    m.mlCommission += Number(row.meli_fee)
    m.shippingCost += Number(row.shipping_charge)
    m.taxWithholding += Number(row.tax_withholding)
    m.orderCount += 1

    // Full lo despacha ML: no hay a quién pagarle por paquete.
    const canal = canalDe(row.charges)
    if (canal === 'flex') {
      m.bodegaFee += BODEGA_FEE_FLEX_COP
      m.courierFee += FLEX_COURIER_FEE_COP
    } else if (canal === 'agencia') {
      m.bodegaFee += FULFILLMENT_FEE_AGENCIA_COP
    }
  }

  for (const b of bonuses ?? []) {
    if (!b.date_approved) continue
    const m = acc.get(b.date_approved.slice(0, 7))
    if (m) m.shippingBonus += Number(b.transaction_amount)
  }

  for (const g of gastos ?? []) {
    const m = acc.get(String(g.spent_on).slice(0, 7))
    if (m) m.expenses += Number(g.amount)
  }

  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  return months.map((key) => {
    const m = acc.get(key)!
    const adsCost = ads.get(key) ?? 0
    const productCost = productCosts.get(key) ?? 0

    // Lo que el desglose no explica del neto real, para que la columna cuadre.
    const otherMlCharges =
      Math.round((m.grossSales - m.mlCommission - m.shippingCost - m.taxWithholding - m.netFromMl) * 100) / 100

    const netProfit =
      m.netFromMl + m.shippingBonus - productCost - m.bodegaFee - m.courierFee - adsCost - m.expenses

    return {
      key,
      label: monthLabel(key),
      isPartial: key === currentMonth,
      grossSales: m.grossSales,
      orderCount: m.orderCount,
      mlCommission: m.mlCommission,
      shippingCost: m.shippingCost,
      taxWithholding: m.taxWithholding,
      otherMlCharges,
      shippingBonus: m.shippingBonus,
      productCost,
      bodegaFee: m.bodegaFee,
      courierFee: m.courierFee,
      expenses: m.expenses,
      ads: adsCost,
      netProfit,
      marginRate: m.grossSales > 0 ? netProfit / m.grossSales : 0,
    }
  })
}
