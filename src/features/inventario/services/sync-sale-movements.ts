import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getListingMap } from './get-product-catalog'

export interface SaleLine {
  itemId: string
  quantity: number
}

/**
 * Fires whenever a shipment is confirmed dispatched (delivered_at set) — see
 * mark-delivered.ts and sync-delivered.ts. Uses the service-role client
 * because the bodega user marking their own delivery has no direct write
 * access to inventory_movements (RLS: bodega reads own warehouse only) —
 * this is a trusted system-triggered write, same pattern ml-client.ts uses
 * to read ml_tokens.
 *
 * Idempotent via inventory_movements' partial unique index on
 * (shipment_id, product_id) for salida_venta — this runs on every page load
 * that touches an already-resolved shipment, so repeat calls just hit a
 * unique violation (23505) and no-op instead of double-decrementing.
 *
 * Items with no product_listings mapping are skipped, not errored — an
 * unmapped ML listing is surfaced separately via discover-listings.ts for a
 * human to map, rather than blocking the delivery flow.
 *
 * Known limitation: if a shipment's warehouse is reassigned AFTER this has
 * already run, the movement stays booked against the original warehouse —
 * acceptable since reassignment only happens before dispatch in practice.
 */
export async function syncSaleMovements(
  shipmentId: number,
  warehouseId: string | null,
  items: SaleLine[]
): Promise<void> {
  if (!warehouseId || items.length === 0) return

  const listingMap = await getListingMap()
  const supabase = createAdminClient()

  for (const item of items) {
    const listing = listingMap.get(item.itemId)
    if (!listing) continue

    const { error } = await supabase.from('inventory_movements').insert({
      product_id: listing.productId,
      warehouse_id: warehouseId,
      qty: -(item.quantity * listing.unitsPerSale),
      type: 'salida_venta',
      shipment_id: shipmentId,
    })

    if (error && error.code !== '23505') {
      throw new Error(`No se pudo registrar la salida de inventario: ${error.message}`)
    }
  }
}
