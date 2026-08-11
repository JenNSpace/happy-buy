'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function markDelivered(shipmentId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autenticado' }
  }

  const { error } = await supabase
    .from('shipments')
    .update({ delivered_at: new Date().toISOString(), delivered_by: user.id })
    .eq('id', shipmentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/logistica')
  return { success: true }
}
