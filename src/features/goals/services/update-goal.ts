'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateGoal(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autenticado' }
  }

  const targetAmount = Number(formData.get('target_amount'))
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: 'Ingresa un monto válido' }
  }

  const { error } = await supabase.from('goals').insert({
    metric: 'weekly_profit',
    target_amount: targetAmount,
    updated_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
