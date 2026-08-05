import 'server-only'
import { mlGet } from './ml-client'
import {
  ML_USER_ID,
  ML_SALE_COMMISSION_RATE,
  PRODUCT_COST_PER_UNIT_COP,
  SHIPPING_COST_SINGLE_UNIT_COP,
  SHIPPING_COST_PACK_X2_COP,
  FULFILLMENT_FEE_FULL_COP,
  ITEM_PACK_SIZE,
} from '../constants'
import type { FinancialSummary } from '../types'

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

function shippingCostForItem(itemId: string): number {
  const packSize = ITEM_PACK_SIZE[itemId] ?? 1
  if (packSize <= 1) return SHIPPING_COST_SINGLE_UNIT_COP
  // Bundles ship far more efficiently than N singles — use the real Pack X2 rate per unit as the estimate for all bundles.
  return (SHIPPING_COST_PACK_X2_COP / 2) * packSize
}

export async function getFinancialSummary(days = 7): Promise<FinancialSummary> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
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

  for (const order of paidOrders) {
    for (const line of order.order_items) {
      const lineTotal = line.unit_price * line.quantity
      grossSales += lineTotal
      unitsSold += line.quantity
      productCost += PRODUCT_COST_PER_UNIT_COP * line.quantity
      shippingCost += shippingCostForItem(line.item.id)
      fulfillmentFee += FULFILLMENT_FEE_FULL_COP // one package per order line (current real-world default: not using Flex)
    }
  }

  const mlCommission = grossSales * ML_SALE_COMMISSION_RATE
  const netProfit = grossSales - mlCommission - shippingCost - productCost - fulfillmentFee
  const marginRate = grossSales > 0 ? netProfit / grossSales : 0

  return {
    periodLabel: `Últimos ${days} días`,
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
