import 'server-only'
import { mlGet } from './ml-client'
import { ML_USER_ID, computeOrderLineMetrics } from '../constants'
import type { SalesHistoryPoint } from '../types'

interface MlOrderItem {
  item: { id: string }
  quantity: number
  unit_price: number
}

interface MlOrder {
  status: string
  date_created: string
  order_items: MlOrderItem[]
}

interface MlOrdersSearchResponse {
  paging: { total: number; offset: number; limit: number }
  results: MlOrder[]
}

const PAGE_SIZE = 50
const MAX_ORDERS = 500 // safety cap, well above real order volume — avoids runaway pagination

function toPoints(orders: MlOrder[]): SalesHistoryPoint[] {
  return orders
    .filter((o) => o.status === 'paid')
    .map((order) => {
      let grossSales = 0
      let netProfit = 0
      let unitsSold = 0

      for (const line of order.order_items) {
        const m = computeOrderLineMetrics(line.item.id, line.quantity, line.unit_price)
        grossSales += m.grossSales
        netProfit += m.netProfit
        unitsSold += line.quantity
      }

      return { dateCreated: order.date_created, grossSales, netProfit, unitsSold }
    })
}

/**
 * Fetches raw order-level sales data over a wide window (default 90 days) in
 * one go. Bucketing by hour/weekday/week/month happens client-side so the
 * granularity toggle is instant and never re-fetches.
 */
export async function getSalesHistory(days = 90): Promise<SalesHistoryPoint[]> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 19) + '.000-00:00'

  const searchUrl = (offset: number) => {
    const query = new URLSearchParams({
      seller: ML_USER_ID,
      'order.date_created.from': fmt(from),
      'order.date_created.to': fmt(to),
      sort: 'date_desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    return `/orders/search?${query.toString()}`
  }

  const first = await mlGet<MlOrdersSearchResponse>(searchUrl(0))
  const points = toPoints(first.results)

  const total = Math.min(first.paging.total, MAX_ORDERS)
  const remainingOffsets: number[] = []
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    remainingOffsets.push(offset)
  }

  if (remainingOffsets.length > 0) {
    const pages = await Promise.all(
      remainingOffsets.map((offset) => mlGet<MlOrdersSearchResponse>(searchUrl(offset)))
    )
    for (const page of pages) {
      points.push(...toPoints(page.results))
    }
  }

  return points
}
