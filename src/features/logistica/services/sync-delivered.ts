import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getFulfillmentType, needsDispatch, type MlShipmentCore } from './parse-shipment'
import { syncSaleMovements, type SaleLine } from '@/features/inventario/services/sync-sale-movements'

/**
 * ML itself is the source of truth for "was this actually handed to the
 * carrier" — the same signal behind the dispatch-confirmation email ML
 * sends the user, but reachable via the API we already call, for both
 * Flex and Agencia (the email is agencia-only). If ML's status has moved
 * past "needs dispatch" (i.e. `shipped` or later) and our own record
 * still shows `delivered_at` as null — e.g. Gina forgot to click "Marcar
 * entregado" — this fills it in with ML's real `date_shipped`, so the
 * local record self-corrects on the next page load instead of relying on
 * a manual click as the only way it ever gets recorded.
 *
 * Also syncs the inventory decrement (see sync-sale-movements.ts).
 *
 * Creates the local row when one doesn't exist yet. Found in the
 * 2026-08-18 audit: shipment 47756002876 was dispatched on 14-ago having
 * never been assigned a warehouse, so there was no row to UPDATE — the
 * write silently matched nothing, the shipment was never recorded, and its
 * 2 units of stock were never deducted. An order can leave without ever
 * being assigned, so "no local row" has to be a real branch, not an
 * assumption that admin always assigns first.
 */
export async function syncAutoDelivered(
  shipmentId: number,
  orderId: number,
  details: MlShipmentCore,
  warehouseId: string | null,
  items: SaleLine[]
): Promise<void> {
  if (needsDispatch(details)) return

  const supabase = await createClient()
  const deliveredAt = details.status_history.date_shipped ?? new Date().toISOString()
  const fulfillmentType = getFulfillmentType(details)

  const { data: updated } = await supabase
    .from('shipments')
    .update({ delivered_at: deliveredAt, fulfillment_type: fulfillmentType })
    .eq('id', shipmentId)
    .is('delivered_at', null)
    .select('warehouse_id')
    .maybeSingle()

  let warehouse = updated?.warehouse_id ?? warehouseId

  // Nothing updated means either "already marked delivered" or "no row at all".
  if (!updated) {
    const { data: existing } = await supabase
      .from('shipments')
      .select('warehouse_id')
      .eq('id', shipmentId)
      .maybeSingle()

    if (existing) {
      warehouse = existing.warehouse_id ?? warehouseId
    } else {
      await supabase.from('shipments').insert({
        id: shipmentId,
        order_id: orderId,
        warehouse_id: warehouseId,
        delivered_at: deliveredAt,
        fulfillment_type: fulfillmentType,
      })
    }
  }

  await syncSaleMovements(shipmentId, warehouse, items)
}
