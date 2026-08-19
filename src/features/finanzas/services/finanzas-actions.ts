'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const expenseSchema = z.object({
  category: z.string().trim().min(1, 'Elige o escribe una categoría'),
  description: z.string().trim().max(200).optional(),
  amount: z.number().positive('El monto debe ser mayor a cero'),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Falta la fecha'),
  paymentMethodId: z.string().uuid().optional().or(z.literal('')),
  warehouseId: z.string().uuid().optional().or(z.literal('')),
  isReimbursement: z.boolean().default(false),
})

export type ExpenseInput = z.infer<typeof expenseSchema>

export async function createExpense(input: ExpenseInput) {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const warehouseId = parsed.data.warehouseId || null

  const { error } = await supabase.from('expenses').insert({
    category: parsed.data.category,
    description: parsed.data.description || null,
    amount: parsed.data.amount,
    spent_on: parsed.data.spentOn,
    payment_method_id: parsed.data.paymentMethodId || null,
    warehouse_id: warehouseId,
    // Sin bodega no hay a quién reembolsarle: se ignora la marca.
    is_reimbursement: warehouseId ? parsed.data.isReimbursement : false,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/finanzas')
  return { success: true }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/finanzas')
  return { success: true }
}

const cardSchema = z.object({
  methodId: z.string().uuid(),
  creditLimit: z.number().nonnegative().nullable(),
  statementDay: z.number().int().min(1).max(31).nullable(),
  dueDay: z.number().int().min(1).max(31).nullable(),
})

export type CardSettingsInput = z.infer<typeof cardSchema>

export async function updateCardSettings(input: CardSettingsInput) {
  const parsed = cardSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('payment_methods')
    .update({
      credit_limit: parsed.data.creditLimit,
      statement_day: parsed.data.statementDay,
      due_day: parsed.data.dueDay,
    })
    .eq('id', parsed.data.methodId)

  if (error) return { error: error.message }

  revalidatePath('/finanzas')
  return { success: true }
}
