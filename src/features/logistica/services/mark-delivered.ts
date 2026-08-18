'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { syncSaleMovements, type SaleLine } from '@/features/inventario/services/sync-sale-movements'

export async function markDelivered(shipmentId: number, items: SaleLine[] = [], fulfillmentType?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autenticado' }
  }

  const { data, error } = await supabase
    .from('shipments')
    .update({ delivered_at: new Date().toISOString(), delivered_by: user.id, fulfillment_type: fulfillmentType ?? null })
    .eq('id', shipmentId)
    .select('warehouse_id')
    .single()

  if (error) {
    return { error: error.message }
  }

  await syncSaleMovements(shipmentId, data.warehouse_id, items)

  revalidatePath('/logistica')
  return { success: true }
}
