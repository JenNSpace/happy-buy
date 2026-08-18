'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { syncSaleMovements } from '@/features/inventario/services/sync-sale-movements'

interface MlShipmentItems {
  shipping_items: { id: string; quantity: number }[]
}

export async function assignWarehouse(shipmentId: number, orderId: number, warehouseId: string | null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autenticado' }
  }

  const { error } = await supabase
    .from('shipments')
    .upsert({ id: shipmentId, order_id: orderId, warehouse_id: warehouseId }, { onConflict: 'id' })

  if (error) {
    return { error: error.message }
  }

  /**
   * Assigning a warehouse to an ALREADY-dispatched shipment is the moment its
   * stock finally gets deducted. Shipments that went out without ever being
   * assigned (see sync-dispatched.ts) had no warehouse to book the movement
   * against at dispatch time, so the deduction has to happen here instead —
   * otherwise stock stays permanently overstated. Safe to run on every assign:
   * syncSaleMovements is idempotent via a unique index on (shipment_id, product_id).
   */
  if (warehouseId) {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('delivered_at')
      .eq('id', shipmentId)
      .maybeSingle()

    if (shipment?.delivered_at) {
      try {
        const details = await mlGet<MlShipmentItems>(`/shipments/${shipmentId}`)
        await syncSaleMovements(
          shipmentId,
          warehouseId,
          details.shipping_items.map((i) => ({ itemId: i.id, quantity: i.quantity }))
        )
      } catch {
        // The assignment itself succeeded; a failed stock sync must not undo it.
        // The next page load retries via syncAutoDelivered.
      }
    }
  }

  revalidatePath('/logistica')
  return { success: true }
}
