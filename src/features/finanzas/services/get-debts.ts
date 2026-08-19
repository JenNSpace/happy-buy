import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { PaymentMethod } from '@/types/database'

export interface Debt {
  method: PaymentMethod
  /** Compras sin pagar + gastos cargados a este método. */
  owed: number
  purchaseCount: number
  expenseCount: number
  /** Fracción del cupo usada. Null si no hay cupo registrado. */
  usage: number | null
  available: number | null
  /** Próxima fecha de corte, como texto corto. Null si no está registrada. */
  nextStatement: string | null
}

/** Próxima ocurrencia de un día del mes, en texto corto ("15 de septiembre"). */
function nextOccurrence(day: number | null): string | null {
  if (!day) return null
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), day)
  if (target < now) target.setMonth(target.getMonth() + 1)
  return target.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

/**
 * Deuda por método de pago.
 *
 * Suma dos fuentes: compras marcadas como no pagadas y gastos operativos
 * cargados al mismo método. Un gasto de empaques con la Falabella es deuda de
 * esa tarjeta igual que una compra de producto.
 */
export async function getDebts(): Promise<Debt[]> {
  const supabase = await createClient()

  const [{ data: methods }, { data: purchases }, { data: expenses }] = await Promise.all([
    supabase.from('payment_methods').select('*').order('name').returns<PaymentMethod[]>(),
    supabase.from('purchases').select('payment_method_id, total_cost, other_cost').eq('paid', false),
    supabase.from('expenses').select('payment_method_id, amount'),
  ])

  const owedByMethod = new Map<string, { amount: number; purchases: number; expenses: number }>()

  const bump = (id: string | null, amount: number, kind: 'purchase' | 'expense') => {
    if (!id) return
    const cur = owedByMethod.get(id) ?? { amount: 0, purchases: 0, expenses: 0 }
    cur.amount += amount
    if (kind === 'purchase') cur.purchases += 1
    else cur.expenses += 1
    owedByMethod.set(id, cur)
  }

  for (const p of purchases ?? []) {
    bump(p.payment_method_id, Number(p.total_cost) + Number(p.other_cost ?? 0), 'purchase')
  }
  for (const e of expenses ?? []) {
    bump(e.payment_method_id, Number(e.amount), 'expense')
  }

  return (methods ?? [])
    // El efectivo no acumula deuda: se paga en el momento.
    .filter((m) => m.kind !== 'efectivo')
    .map((method) => {
      const owed = owedByMethod.get(method.id)
      const amount = owed?.amount ?? 0
      const limit = method.credit_limit != null ? Number(method.credit_limit) : null

      return {
        method,
        owed: amount,
        purchaseCount: owed?.purchases ?? 0,
        expenseCount: owed?.expenses ?? 0,
        usage: limit && limit > 0 ? amount / limit : null,
        available: limit != null ? limit - amount : null,
        nextStatement: nextOccurrence(method.statement_day),
      }
    })
}
