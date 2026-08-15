import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { PaymentMethod } from '@/types/database'

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('payment_methods').select('*').order('name').returns<PaymentMethod[]>()

  return data ?? []
}
