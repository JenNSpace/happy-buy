'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  revalidatePath('/logistica')
  return { success: true }
}
