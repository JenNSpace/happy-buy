import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { needsDispatch, type MlShipmentCore } from './parse-shipment'
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
 * Also syncs the inventory decrement (see sync-sale-movements.ts) — both
 * for shipments this call newly marks delivered, and as a backstop for
 * ones already delivered before this existed (falls back to the
 * caller-supplied warehouseId when the update matches nothing).
 */
export async function syncAutoDelivered(
  shipmentId: number,
  details: MlShipmentCore,
  warehouseId: string | null,
  items: SaleLine[]
): Promise<void> {
  if (needsDispatch(details)) return

  const supabase = await createClient()
  const { data } = await supabase
    .from('shipments')
    .update({ delivered_at: details.status_history.date_shipped ?? new Date().toISOString() })
    .eq('id', shipmentId)
    .is('delivered_at', null)
    .select('warehouse_id')
    .maybeSingle()

  await syncSaleMovements(shipmentId, data?.warehouse_id ?? warehouseId, items)
}
