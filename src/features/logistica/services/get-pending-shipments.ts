import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { ML_USER_ID } from '@/features/dashboard/constants'
import { createClient } from '@/lib/supabase/server'
import {
  getDispatchState,
  getFulfillmentType,
  isLabelPrinted,
  needsDispatch,
  type MlShipmentCore,
} from './parse-shipment'
import { syncAutoDelivered } from './sync-delivered'
import { getShipmentSla } from './get-shipment-sla'
import { getDispatchCutoff } from '../utils/dispatch-cutoff'
import type { Shipment } from '@/types/database'
import type { PendingShipment } from '../types'

interface MlVariationAttribute {
  name: string
  value_name: string
}

interface MlOrderItem {
  item: {
    id: string
    title: string
    seller_sku: string | null
    variation_attributes: MlVariationAttribute[]
  }
  quantity: number
}

interface MlOrder {
  id: number
  date_created: string
  order_items: MlOrderItem[]
  shipping: { id: number }
  buyer: { nickname: string }
}

interface MlOrdersSearchResponse {
  paging: { total: number; offset: number; limit: number }
  results: MlOrder[]
}

interface MlShipmentDetails extends MlShipmentCore {
  id: number
}

const PAGE_SIZE = 50

/**
 * Widened from 7 to 30 days in the 2026-08-18 audit. At 7 days, a package
 * that stalled for 8 days silently VANISHED from the board while still
 * genuinely needing dispatch — the exact "nos van a faltar paquetes"
 * failure. The original 7-day bound existed to hide months of stale
 * `not_delivered` orders, but that job is really done by the
 * `needsDispatch(status)` filter below, which drops anything ML already
 * considers shipped. Verified over a 90-day window: zero extra noise.
 */
const WINDOW_DAYS = 30

/** Older than this and still undispatched is abnormal — surfaced, never hidden. */
export const STALE_AFTER_DAYS = 7

/**
 * Admin view: orders from the last 7 days that Mercado Libre still
 * considers not-delivered AND whose shipment's real `status` still needs
 * OUR action (`pending`/`handling`/`ready_to_ship` — see `needsDispatch`).
 *
 * Deliberately checks the shipment's own `status`, not just the order
 * search's `not_delivered` tag or `/sla`'s liveness: found live 2026-08-06
 * that a shipment already marked `status: "shipped"` the day before (i.e.
 * already handed to the carrier) still had a "live" `/sla` and the
 * `not_delivered` tag, and was incorrectly still showing as pending — a
 * real risk of the warehouse re-handling something already sent. `status`
 * is the one field that actually distinguishes "still with us" from
 * "already gone".
 *
 * Cross-referenced with our local `shipments` table to know which
 * warehouse (if any) it's been assigned to. Product/address stay live
 * from ML — the deadline is our own fixed dispatch cutoff, and warehouse
 * assignment/delivery mark are ours to keep.
 *
 * Bounded to the last week on purpose — the `not_delivered` tag alone goes
 * back months to stale/abandoned orders the user doesn't recognize and
 * doesn't want to see here (confirmed 2026-08-06). Newest first, matching
 * ML's own seller dashboard ordering.
 */
export async function getPendingShipmentsForAdmin(): Promise<PendingShipment[]> {
  const to = new Date()
  const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 19) + '.000-00:00'

  const searchUrl = (offset: number) => {
    const query = new URLSearchParams({
      seller: ML_USER_ID,
      tags: 'not_delivered',
      'order.date_created.from': fmt(from),
      'order.date_created.to': fmt(to),
      sort: 'date_desc',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    return `/orders/search?${query.toString()}`
  }

  const first = await mlGet<MlOrdersSearchResponse>(searchUrl(0))
  const orders = [...first.results]

  for (let offset = PAGE_SIZE; offset < first.paging.total; offset += PAGE_SIZE) {
    const page = await mlGet<MlOrdersSearchResponse>(searchUrl(offset))
    orders.push(...page.results)
  }

  const ordersWithShipping = orders.filter((order) => order.shipping?.id)

  const details = await Promise.all(
    ordersWithShipping.map((order) => mlGet<MlShipmentDetails>(`/shipments/${order.shipping.id}`))
  )
  // ML's own dispatch clock per shipment — the day a package is due is ML's to
  // decide (business days, holidays, cutoff), not ours. See `getDispatchCutoff`.
  const slas = await Promise.all(ordersWithShipping.map((order) => getShipmentSla(order.shipping.id)))
  const enriched = ordersWithShipping.map((order, i) => ({ order, details: details[i], sla: slas[i] }))

  const supabase = await createClient()
  const { data: localShipments } = await supabase.from('shipments').select('*')
  const localById = new Map<number, Shipment>((localShipments ?? []).map((s) => [s.id, s as Shipment]))

  await Promise.all(
    enriched
      .filter(({ details }) => !needsDispatch(details))
      .map(({ order, details }) =>
        syncAutoDelivered(
          details.id,
          order.id,
          details,
          localById.get(order.shipping.id)?.warehouse_id ?? null,
          order.order_items.map((i) => ({ itemId: i.item.id, quantity: i.quantity }))
        )
      )
  )

  return enriched
    .filter(({ details }) => needsDispatch(details))
    .map(({ order, details, sla }) => {
      const local = localById.get(order.shipping.id)
      const fulfillmentType = getFulfillmentType(details)
      return {
        shipmentId: order.shipping.id,
        orderId: order.id,
        dateCreated: order.date_created,
        deadline: getDispatchCutoff(fulfillmentType, sla.expectedDate),
        slaStatus: sla.status,
        fulfillmentType,
        printed: isLabelPrinted(details),
        buyerNickname: order.buyer.nickname,
        items: order.order_items.map((i) => ({
          itemId: i.item.id,
          title: i.item.title,
          quantity: i.quantity,
        })),
        warehouseId: local?.warehouse_id ?? null,
        deliveredAt: local?.delivered_at ?? null,
        dispatchState: getDispatchState(details),
      }
    })
    // Already handed off by the warehouse — no longer admin's concern.
    .filter((s) => !s.deliveredAt)
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
}
