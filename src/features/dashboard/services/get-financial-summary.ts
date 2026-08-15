import 'server-only'
import { mlGet } from './ml-client'
import { ML_USER_ID, computeOrderLineMetrics } from '../constants'
import { getListingMap, type ListingInfo } from '@/features/inventario/services/get-product-catalog'
import type { FinancialSummary, PeriodMetrics } from '../types'

interface MlOrderItem {
  item: { id: string; title: string }
  quantity: number
  unit_price: number
}

interface MlOrder {
  id: number
  status: string
  total_amount: number
  order_items: MlOrderItem[]
}

interface MlOrdersSearchResponse {
  paging: { total: number; offset: number; limit: number }
  results: MlOrder[]
}

async function fetchPeriodMetrics(
  from: Date,
  to: Date,
  periodLabel: string,
  listingMap: Map<string, ListingInfo>
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

  let grossSales = 0
  let unitsSold = 0
  let shippingCost = 0
  let productCost = 0
  let fulfillmentFee = 0
  let mlCommission = 0
  let netProfit = 0

  for (const order of paidOrders) {
    for (const line of order.order_items) {
      const unitsPerSale = listingMap.get(line.item.id)?.unitsPerSale ?? 1
      const m = computeOrderLineMetrics(line.quantity, line.unit_price, unitsPerSale)
      grossSales += m.grossSales
      unitsSold += line.quantity * unitsPerSale
      mlCommission += m.mlCommission
      shippingCost += m.shippingCost
      productCost += m.productCost
      fulfillmentFee += m.fulfillmentFee
      netProfit += m.netProfit
    }
  }

  const marginRate = grossSales > 0 ? netProfit / grossSales : 0

  return {
    periodLabel,
    orderCount: paidOrders.length,
    unitsSold,
    grossSales,
    mlCommission,
    shippingCost,
    productCost,
    fulfillmentFee,
    netProfit,
    marginRate,
  }
}

export async function getFinancialSummary(days = 7): Promise<FinancialSummary> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const previousTo = from
  const previousFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000)

  const listingMap = await getListingMap()
  const [current, previousPeriod] = await Promise.all([
    fetchPeriodMetrics(from, to, `Últimos ${days} días`, listingMap),
    fetchPeriodMetrics(previousFrom, previousTo, `${days} días anteriores`, listingMap),
  ])

  return { ...current, previousPeriod }
}
