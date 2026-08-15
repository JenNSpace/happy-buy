import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Purchase } from '@/types/database'

export async function getPurchases(): Promise<Purchase[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('purchases')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<Purchase[]>()

  return data ?? []
}
