import { createClient } from '@/lib/supabase/server'
import type { Goal } from '@/types/database'

export async function getGoal(metric = 'weekly_profit'): Promise<Goal | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('metric', metric)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo leer la meta: ${error.message}`)
  }

  return data
}
