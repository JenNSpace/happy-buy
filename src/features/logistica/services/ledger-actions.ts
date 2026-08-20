'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getGeneratedInRange } from './get-warehouse-ledger'
import { getBillingStatement, type BillingStatement } from './get-billing-statement'

/**
 * Qué generó la bodega en un rango, para comparar contra lo que se va a pagar.
 *
 * Se consulta ANTES de registrar el pago: el 2026-08-18 Enrique pagó $78.000
 * contra una cuenta que se había quedado corta en $6.800, y la diferencia
 * apareció días después. Verla en el momento es lo que evita repetirlo.
 */
export async function previewRange(
  warehouseId: string,
  from: string,
  to: string
): Promise<{ error: string } | { success: true; packages: number; amount: number }> {
  if (!warehouseId || !from || !to) return { error: 'Faltan datos del rango' }
  if (from > to) return { error: 'La fecha inicial es posterior a la final' }

  const generated = await getGeneratedInRange(warehouseId, from, to)
  return { success: true, ...generated }
}

export async function loadStatement(
  warehouseId: string,
  from: string,
  to: string
): Promise<{ error: string } | { success: true; statement: BillingStatement }> {
  if (!warehouseId || !from || !to) return { error: 'Faltan datos del rango' }
  if (from > to) return { error: 'La fecha inicial es posterior a la final' }

  const statement = await getBillingStatement(warehouseId, from, to)
  if (!statement) return { error: 'No se encontró la bodega' }
  return { success: true, statement }
}

/**
 * Registra un pago real. El rango es lo que la cuenta de cobro dice cubrir —
 * informativo, puede ser cualquiera. El saldo sale de sumar montos, así que un
 * pago parcial, adelantado o a caballo entre dos quincenas se registra igual.
 */
export async function registerPayment(input: {
  warehouseId: string
  amount: number
  from: string
  to: string
  packages?: number
  note?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.amount || input.amount <= 0) return { error: 'El monto tiene que ser mayor a cero' }
  if (!input.from || !input.to) return { error: 'Falta el rango que cubre el pago' }
  if (input.from > input.to) return { error: 'La fecha inicial es posterior a la final' }

  // Guarda contra el doble registro. Ya pasó de verdad (2026-08-18): un panel
  // que se cerró justo al mostrar el mensaje de éxito dejó dos registros del
  // mismo pago. Aquí se detecta por monto y rango idénticos en los últimos
  // minutos, que es la forma que toma un doble clic o un reintento.
  const hace5min = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data: reciente } = await supabase
    .from('warehouse_payments')
    .select('id')
    .eq('warehouse_id', input.warehouseId)
    .eq('amount', input.amount)
    .eq('period_start', input.from)
    .gte('created_at', hace5min)
    .maybeSingle()

  if (reciente) {
    return { error: 'Ese mismo pago se acaba de registrar hace un momento. Revisa la lista antes de volver a guardarlo.' }
  }

  const { error } = await supabase.from('warehouse_payments').insert({
    warehouse_id: input.warehouseId,
    period_start: input.from,
    period_end: input.to,
    packages: input.packages ?? null,
    amount: input.amount,
    note: input.note?.trim() || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/logistica')
  return { success: true }
}

export async function deletePayment(paymentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('warehouse_payments').delete().eq('id', paymentId)
  if (error) return { error: error.message }

  revalidatePath('/logistica')
  return { success: true }
}
