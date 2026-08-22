'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { MpAllocation, MpMovement } from '@/types/database'

/** Nombre del gasto que se crea. Coincide con lo que Jen ya escribe a mano. */
const EXPENSE_CATEGORY = {
  insumos: 'Empaques e insumos',
  publicidad: 'Publicidad',
  otro: 'Otro',
} as const

const allocationSchema = z.object({
  movementId: z.string().min(1),
  amount: z.number().positive('El monto debe ser mayor a cero'),
  category: z.enum(['producto', 'bodegas', 'insumos', 'publicidad', 'personal', 'otro']),
  note: z.string().trim().max(200).optional(),
  purchaseId: z.string().uuid().optional().or(z.literal('')),
  warehousePaymentId: z.string().uuid().optional().or(z.literal('')),
  /** Crear también el gasto: solo para lo que NO está contado en ningún otro lado. */
  alsoRecordExpense: z.boolean().default(false),
})
  // Cada enlace a su categoría. El costo de producto ya entró el día de la
  // compra y el de bodegas paquete por paquete al despachar — volver a sumarlos
  // los contaría dos veces. Lo personal no se cruza con nada, a propósito.
  .refine((v) => !v.purchaseId || v.category === 'producto', {
    message: 'Solo una salida de producto se puede cruzar con una compra',
    path: ['purchaseId'],
  })
  .refine((v) => !v.warehousePaymentId || v.category === 'bodegas', {
    message: 'Solo una salida de bodegas se puede cruzar con un pago a bodega',
    path: ['warehousePaymentId'],
  })
  .refine((v) => !v.alsoRecordExpense || ['insumos', 'publicidad', 'otro'].includes(v.category), {
    message: 'Producto y bodegas ya están contados; registrarlos como gasto los duplicaría',
    path: ['alsoRecordExpense'],
  })

export type AllocationInput = z.infer<typeof allocationSchema>

export async function addAllocation(input: AllocationInput) {
  const parsed = allocationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { movementId, amount, category, note, purchaseId, warehousePaymentId, alsoRecordExpense } =
    parsed.data

  // Nadie puede explicar más plata de la que salió. Se valida contra la base y no
  // contra lo que trae el formulario: dos personas clasificando el mismo retiro a
  // la vez verían cada una un "disponible" que ya no existe.
  const [{ data: movement }, { data: existing }] = await Promise.all([
    supabase.from('mp_movements').select('amount').eq('id', movementId).single<Pick<MpMovement, 'amount'>>(),
    supabase
      .from('mp_allocations')
      .select('amount')
      .eq('movement_id', movementId)
      .returns<Pick<MpAllocation, 'amount'>[]>(),
  ])

  if (!movement) return { error: 'Ese movimiento ya no existe' }

  const assigned = (existing ?? []).reduce((sum, a) => sum + Number(a.amount), 0)
  const available = Math.round((Number(movement.amount) - assigned) * 100) / 100

  if (amount > available) {
    return {
      error:
        available <= 0
          ? 'Este retiro ya está explicado completo'
          : `Solo quedan $${available.toLocaleString('es-CO')} por explicar en este retiro`,
    }
  }

  // El gasto va primero: si falla, no queda un reparto sin su contraparte. Al
  // revés sí sería recuperable, pero esto ahorra el caso raro.
  let expenseId: string | null = null
  if (alsoRecordExpense) {
    const { data: movementRow } = await supabase
      .from('mp_movements')
      .select('moved_on')
      .eq('id', movementId)
      .single<{ moved_on: string }>()

    const { data: created, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        category: EXPENSE_CATEGORY[category as 'insumos' | 'publicidad' | 'otro'],
        description: note || null,
        amount,
        spent_on: movementRow?.moved_on ?? new Date().toISOString().slice(0, 10),
        // La plata salió de Mercado Pago, no de una tarjeta: no genera deuda.
        payment_method_id: null,
        warehouse_id: null,
        is_reimbursement: false,
        created_by: user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (expenseError) return { error: `No se pudo registrar el gasto: ${expenseError.message}` }
    expenseId = created?.id ?? null
  }

  const { error } = await supabase.from('mp_allocations').insert({
    movement_id: movementId,
    amount,
    category,
    note: note || null,
    purchase_id: purchaseId || null,
    warehouse_payment_id: warehousePaymentId || null,
    expense_id: expenseId,
    created_by: user.id,
  })

  if (error) {
    // Sin el reparto, el gasto quedaría suelto e invisible desde la bandeja.
    if (expenseId) await supabase.from('expenses').delete().eq('id', expenseId)
    return { error: error.message }
  }

  // El trigger sync_purchase_paid ya marcó la compra como pagada, y eso cambia
  // la deuda de la tarjeta que se ve en /compras.
  revalidatePath('/finanzas')
  revalidatePath('/compras')
  revalidatePath('/logistica')
  return { success: true }
}

export async function deleteAllocation(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('mp_allocations').delete().eq('id', id)
  if (error) return { error: error.message }

  // Quitar el reparto devuelve la compra a "sin pagar" — si no, un error de
  // dedo dejaría una deuda oculta que no se puede recuperar desde la pantalla.
  revalidatePath('/finanzas')
  revalidatePath('/compras')
  return { success: true }
}
