import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { ML_USER_ID } from '@/features/dashboard/constants'
import { createClient } from '@/lib/supabase/server'
import { getFulfillmentType, needsDispatch, type MlShipmentCore } from './parse-shipment'
import { syncAutoDelivered } from './sync-delivered'
import { getBogotaFortnightStart } from '../utils/dispatch-cutoff'

interface MlOrder {
  id: number
  date_created: string
  status: string
  shipping?: { id: number } | null
  /** Necesarios para descontar inventario al cerrar un envío ya despachado. */
  order_items?: { item: { id: string }; quantity: number }[]
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
 * Only look back far enough to cover the open fortnight. Older shipments are
 * already paid and reconciled outside the app, so pulling 30 days of history
 * just added API calls and surfaced settled work as if it needed attention.
 */
const WINDOW_DAYS = 20

export interface OrphanShipment {
  shipmentId: number
  orderId: number
  dateCreated: string
  fulfillmentType: string
}

/**
 * Records shipments that were dispatched WITHOUT ever being assigned a
 * warehouse in the panel.
 *
 * Root cause found 2026-08-18: the local `shipments` row was only ever created
 * by `assignWarehouse`. Anything nobody assigned simply never entered the
 * system — 16 real shipments dispatched and delivered between 6-ago and 12-ago
 * had no row at all, so they counted toward nobody's fortnight payment and
 * never decremented stock. The pending-shipments sync couldn't catch them
 * either, because that query filters on ML's `not_delivered` tag and these
 * were already delivered.
 *
 * This closes the gap from the other side: it looks at ALL recent orders, not
 * just undelivered ones, and inserts a row for any dispatched shipment we
 * don't know about. `warehouse_id` stays null on purpose — only a human knows
 * who actually took it to the agency, and guessing would corrupt the payroll
 * figure. They're returned so the UI can ask for that assignment; inventory is
 * booked once a warehouse is set (see assignWarehouse).
 */
export async function syncDispatchedShipments(): Promise<OrphanShipment[]> {
  const to = new Date()
  const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
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
  const orders = [...first.results]
  for (let offset = PAGE_SIZE; offset < first.paging.total; offset += PAGE_SIZE) {
    const page = await mlGet<MlOrdersSearchResponse>(searchUrl(offset))
    orders.push(...page.results)
  }

  const paidWithShipping = orders.filter((o) => o.status === 'paid' && o.shipping?.id)
  if (paidWithShipping.length === 0) return []

  const supabase = await createClient()
  const [{ data: known }, { data: fullWarehouse }] = await Promise.all([
    supabase.from('shipments').select('id, warehouse_id, delivered_at'),
    supabase.from('warehouses').select('id').eq('is_fulfillment', true).maybeSingle(),
  ])
  const localById = new Map(
    (known ?? []).map((s) => [s.id as number, s as { id: number; warehouse_id: string | null; delivered_at: string | null }])
  )

  // Envíos que YA tenemos pero sin fecha de despacho. Cierran un hueco real
  // encontrado el 2026-08-18: `getPendingShipmentsForAdmin` busca con
  // `tags: not_delivered`, y en cuanto ML marca el envío como entregado la
  // orden pierde ese tag y desaparece de la búsqueda — así que el sync que
  // rellena `delivered_at` nunca la ve. Si nadie abrió la pantalla entre
  // "pendiente" y "entregado", el envío se perdía: no contaba para el pago de
  // la bodega ni descontaba inventario. Cinco paquetes de Gina del 18-ago
  // estaban exactamente así.
  await closeDeliveredGaps(paidWithShipping, localById)

  const unknown = paidWithShipping.filter((o) => !localById.has(o.shipping!.id))
  if (unknown.length === 0) return []

  const details = await Promise.all(
    unknown.map((o) => mlGet<MlShipmentDetails>(`/shipments/${o.shipping!.id}`))
  )

  const orphans: OrphanShipment[] = []
  const rows = unknown
    .map((order, i) => ({ order, shipment: details[i] }))
    // Still pending: it'll get its row the normal way when admin assigns it.
    .filter(({ shipment }) => !needsDispatch(shipment))
    .map(({ order, shipment }) => {
      const fulfillmentType = getFulfillmentType(shipment)

      // Full ships from ML's own warehouse: there is no human to assign, so
      // routing it to the Full warehouse automatically keeps it out of the
      // "who dispatched this?" queue and lets its stock deduct on its own.
      const isFull = fulfillmentType === 'full'
      const warehouseId = isFull ? (fullWarehouse?.id as string | undefined) ?? null : null

      if (!isFull) {
        orphans.push({
          shipmentId: order.shipping!.id,
          orderId: order.id,
          dateCreated: order.date_created,
          fulfillmentType,
        })
      }

      return {
        id: order.shipping!.id,
        order_id: order.id,
        warehouse_id: warehouseId,
        delivered_at: shipment.status_history.date_shipped ?? order.date_created,
        fulfillment_type: fulfillmentType,
      }
    })

  if (rows.length > 0) {
    await supabase.from('shipments').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  }

  return orphans
}

/**
 * Rellena `delivered_at` en envíos que ya existen localmente pero que ML ya dio
 * por despachados, y descuenta su inventario.
 *
 * Es la red de seguridad del flujo normal: `syncAutoDelivered` solo se ejecuta
 * sobre lo que devuelve la búsqueda `not_delivered`, y un envío entregado ya no
 * está ahí. Sin esto, el trabajo de la bodega desaparece de su quincena.
 */
async function closeDeliveredGaps(
  orders: MlOrder[],
  localById: Map<number, { id: number; warehouse_id: string | null; delivered_at: string | null }>
): Promise<void> {
  const sinFecha = orders.filter((o) => {
    const local = localById.get(o.shipping!.id)
    return local && local.delivered_at === null
  })
  if (sinFecha.length === 0) return

  const details = await Promise.all(
    sinFecha.map((o) => mlGet<MlShipmentDetails>(`/shipments/${o.shipping!.id}`).catch(() => null))
  )

  await Promise.all(
    sinFecha.map(async (order, i) => {
      const shipment = details[i]
      // Sigue siendo nuestro: se rellena cuando de verdad salga.
      if (!shipment || needsDispatch(shipment)) return

      await syncAutoDelivered(
        shipment.id,
        order.id,
        shipment,
        localById.get(order.shipping!.id)?.warehouse_id ?? null,
        (order.order_items ?? []).map((item) => ({ itemId: item.item.id, quantity: item.quantity }))
      )
    })
  )
}

/**
 * Dispatched shipments still missing a warehouse, CURRENT FORTNIGHT ONLY.
 *
 * Scoped deliberately: the first version listed every unassigned shipment on
 * record and showed the user 57 of them, nearly all from fortnights already
 * paid out. Asking her to reconstruct who dispatched a package three weeks ago
 * — that she has already paid for — is pure noise, and noise on a warning
 * banner is how real warnings get ignored. Only the period that is still open
 * for payment is actionable, so only that period is shown. Older ones stay
 * recorded in the table for history.
 */
export async function getUnassignedDispatched(): Promise<
  { shipmentId: number; deliveredAt: string | null; fulfillmentType: string | null }[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shipments')
    .select('id, delivered_at, fulfillment_type')
    .is('warehouse_id', null)
    .not('delivered_at', 'is', null)
    .gte('delivered_at', getBogotaFortnightStart())
    .order('delivered_at', { ascending: false })

  return (data ?? []).map((s) => ({
    shipmentId: s.id,
    deliveredAt: s.delivered_at,
    fulfillmentType: s.fulfillment_type,
  }))
}
