import 'server-only'
import { mlGet } from './ml-client'
import {
  ML_USER_ID,
  computeOrderLineMetrics,
  FALLBACK_PRODUCT_COST_PER_UNIT_COP,
  FALLBACK_SHIPPING_COST_PER_PACKAGE_COP,
  FULFILLMENT_FEE_AGENCIA_COP,
} from '../constants'
import { getListingMap, type ListingInfo } from '@/features/inventario/services/get-product-catalog'
import { getProductCostPerUnit } from '@/features/inventario/services/get-product-costs'
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

/**
 * Product cost is the real per-product figure here, but shipping and the
 * dispatch fee stay estimated: pulling ML's true per-package charge means one
 * extra API call per order, which is fine for the ~dozens of orders in the
 * weekly summary but not for 90 days of history. The weekly "Ganancia real"
 * card is the number to trust to the peso; this chart is for shape and trend.
 */
function toPoints(
  orders: MlOrder[],
  listingMap: Map<string, ListingInfo>,
  productCosts: Map<string, number>
): SalesHistoryPoint[] {
  return orders
    .filter((o) => o.status === 'paid')
    .map((order) => {
      let grossSales = 0
      let mlCommission = 0
      let productCost = 0
      let unitsSold = 0

      for (const line of order.order_items) {
        const listing = listingMap.get(line.item.id)
        const unitsPerSale = listing?.unitsPerSale ?? 1
        const costPerUnit = listing
          ? productCosts.get(listing.productId) ?? FALLBACK_PRODUCT_COST_PER_UNIT_COP
          : FALLBACK_PRODUCT_COST_PER_UNIT_COP

        const m = computeOrderLineMetrics(line.quantity, line.unit_price, unitsPerSale, costPerUnit)
        grossSales += m.grossSales
        mlCommission += m.mlCommission
        productCost += m.productCost
        unitsSold += line.quantity * unitsPerSale
      }

      // Once per package, not per line — matches how ML and the bodega actually charge.
      const netProfit =
        grossSales -
        mlCommission -
        productCost -
        FALLBACK_SHIPPING_COST_PER_PACKAGE_COP -
        FULFILLMENT_FEE_AGENCIA_COP

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

  const [first, listingMap, productCosts] = await Promise.all([
    mlGet<MlOrdersSearchResponse>(searchUrl(0)),
    getListingMap(),
    getProductCostPerUnit(),
  ])
  const points = toPoints(first.results, listingMap, productCosts)

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
      points.push(...toPoints(page.results, listingMap, productCosts))
    }
  }

  return points
}
