import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { createClient } from '@/lib/supabase/server'
import {
  getDispatchState,
  getFulfillmentType,
  isLabelPrinted,
  needsDispatch,
  type MlShipmentCore,
} from './parse-shipment'
import { syncAutoDelivered } from './sync-delivered'
import { getDispatchCutoff } from '../utils/dispatch-cutoff'
import { getShipmentSla } from './get-shipment-sla'
import type { BodegaShipment } from '../types'

interface MlShipmentItem {
  id: string
  description: string
  quantity: number
}

interface MlShipment extends MlShipmentCore {
  id: number
  order_id: number
  shipping_items: MlShipmentItem[]
  receiver_address: { address_line: string; city?: { name: string } }
}

/**
 * Bodega view: RLS on `shipments` already limits this to the caller's own
 * warehouse, so we only need the shipment ids we're allowed to see, then
 * pull the live details (product, address) from ML. The deadline mixes both:
 * ML decides the DAY (its `/sla`), we impose the HOUR, since our job ends at
 * hand-off to the carrier rather than at delivery (see `getDispatchCutoff`).
 *
 * Also drops anything ML's own `status` says is already `shipped` (or
 * later) even if our local `delivered_at` is still null — e.g. if
 * whoever handled it forgot to click "Marcar entregado". Without this, an
 * already-dispatched package could keep showing as pending here, risking
 * a re-send (found live 2026-08-06 — see `needsDispatch`). Those get
 * auto-marked delivered in our own record too (`syncAutoDelivered`), using
 * ML's real dispatch time — so forgetting the button doesn't lose the
 * record, it just self-corrects on the next visit.
 */
export async function getBodegaShipments(): Promise<BodegaShipment[]> {
  const supabase = await createClient()
  const { data: localShipments } = await supabase
    .from('shipments')
    .select('id, warehouse_id')
    .is('delivered_at', null)

  if (!localShipments || localShipments.length === 0) return []

  const details = await Promise.all(localShipments.map((s) => mlGet<MlShipment>(`/shipments/${s.id}`)))
  const warehouseByShipmentId = new Map(localShipments.map((s) => [s.id, s.warehouse_id]))

  const stillPending = details.filter(needsDispatch)
  const alreadyShipped = details.filter((d) => !needsDispatch(d))
  await Promise.all(
    alreadyShipped.map((s) =>
      syncAutoDelivered(
        s.id,
        s.order_id,
        s,
        warehouseByShipmentId.get(s.id) ?? null,
        s.shipping_items.map((i) => ({ itemId: i.id, quantity: i.quantity }))
      )
    )
  )

  // ML's own dispatch clock per shipment — see `getDispatchCutoff` for why the
  // day has to come from ML rather than from our own arithmetic.
  const slas = await Promise.all(stillPending.map((shipment) => getShipmentSla(shipment.id)))

  const shipments: BodegaShipment[] = stillPending.map((shipment, index) => {
    const fulfillmentType = getFulfillmentType(shipment)
    return {
      shipmentId: shipment.id,
      items: shipment.shipping_items.map((i) => ({ itemId: i.id, description: i.description, quantity: i.quantity })),
      address: [shipment.receiver_address.address_line, shipment.receiver_address.city?.name]
        .filter(Boolean)
        .join(', '),
      deadline: getDispatchCutoff(fulfillmentType, slas[index].expectedDate),
      slaStatus: slas[index].status,
      fulfillmentType,
      printed: isLabelPrinted(shipment),
      dispatchState: getDispatchState(shipment),
    }
  })

  return shipments.sort((a, b) => {
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    if (a.deadline) return -1
    if (b.deadline) return 1
    return 0
  })
}
