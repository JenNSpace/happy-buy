'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getBogotaFortnightStart } from '../utils/dispatch-cutoff'

/** End date of the fortnight that `periodStart` opens, as YYYY-MM-DD. */
function periodEndFor(periodStart: string): string {
  const [y, m, d] = periodStart.split('-').map(Number)
  if (d === 1) return `${y}-${String(m).padStart(2, '0')}-15`
  const lastDay = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${lastDay}`
}

/**
 * Manual correction on top of what the app computes from ML. Deltas, never
 * overrides — the automatic figure stays visible so it's always clear what the
 * app found on its own versus what a human added, and why.
 */
export async function addAdjustment(input: {
  warehouseId: string
  packagesDelta: number
  amountDelta: number
  note: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.note.trim()) return { error: 'Escribe de qué es el ajuste' }
  if (!input.packagesDelta && !input.amountDelta) return { error: 'Pon al menos paquetes o un monto' }

  const { error } = await supabase.from('warehouse_adjustments').insert({
    warehouse_id: input.warehouseId,
    period_start: getBogotaFortnightStart().slice(0, 10),
    packages_delta: input.packagesDelta,
    amount_delta: input.amountDelta,
    note: input.note.trim(),
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/logistica')
  return { success: true }
}

export async function removeAdjustment(adjustmentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('warehouse_adjustments').delete().eq('id', adjustmentId)
  if (error) return { error: error.message }

  revalidatePath('/logistica')
  return { success: true }
}

/**
 * Closes out one warehouse's fortnight. The unique index on
 * (warehouse_id, period_start) is what makes a double-click safe — the second
 * insert conflicts instead of recording a second payout for the same period.
 */
export async function markFortnightPaid(input: {
  warehouseId: string
  packages: number
  amount: number
  note?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const periodStart = getBogotaFortnightStart().slice(0, 10)

  const { error } = await supabase.from('warehouse_payments').insert({
    warehouse_id: input.warehouseId,
    period_start: periodStart,
    period_end: periodEndFor(periodStart),
    packages: input.packages,
    amount: input.amount,
    note: input.note || null,
    created_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Esta quincena ya estaba marcada como pagada.' }
    return { error: error.message }
  }

  revalidatePath('/logistica')
  return { success: true }
}

export async function undoFortnightPaid(warehouseId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('warehouse_payments')
    .delete()
    .eq('warehouse_id', warehouseId)
    .eq('period_start', getBogotaFortnightStart().slice(0, 10))

  if (error) return { error: error.message }

  revalidatePath('/logistica')
  return { success: true }
}
