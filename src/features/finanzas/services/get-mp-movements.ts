import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { MpAllocation, MpMovement } from '@/types/database'

/** Cuántos días de salidas se muestran. Un mes largo cubre la quincena y la anterior. */
const WINDOW_DAYS = 45

export interface MovementWithAllocations {
  movement: MpMovement
  allocations: MpAllocation[]
  /** Lo que todavía nadie explicó. Es la alarma: plata que salió sin destino conocido. */
  unassigned: number
}

export interface MovementsView {
  movements: MovementWithAllocations[]
  /** Solo retiros y compras — el costo de adelantar plata no es algo que se reparta. */
  pendingCount: number
  pendingAmount: number
  /** Cuánto se fue a cada categoría en la ventana, ya explicado. */
  byCategory: { category: string; amount: number }[]
  advanceFees: { total: number; count: number }
}

/** El costo de adelantar plata no se reparte en categorías: no lo gastó nadie, lo cobró ML. */
const SPLITTABLE = new Set(['payout', 'purchase'])

export async function getMpMovements(): Promise<MovementsView> {
  const supabase = await createClient()

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [{ data: movementRows }, { data: allocationRows }] = await Promise.all([
    supabase
      .from('mp_movements')
      .select('*')
      .gte('moved_on', since)
      .order('moved_on', { ascending: false })
      .returns<MpMovement[]>(),
    supabase.from('mp_allocations').select('*').returns<MpAllocation[]>(),
  ])

  const movements = movementRows ?? []
  const allocations = allocationRows ?? []

  const byMovement = new Map<string, MpAllocation[]>()
  for (const a of allocations) {
    const list = byMovement.get(a.movement_id)
    if (list) list.push(a)
    else byMovement.set(a.movement_id, [a])
  }

  const rows: MovementWithAllocations[] = movements.map((movement) => {
    const own = byMovement.get(movement.id) ?? []
    const assigned = own.reduce((sum, a) => sum + Number(a.amount), 0)
    return {
      movement,
      allocations: own,
      // Redondeo defensivo: los montos vienen con dos decimales del CSV y una
      // resta en coma flotante deja restos de 0,0000001 que se verían como
      // "sin asignar" cuando en realidad ya cuadró.
      unassigned: Math.max(0, Math.round((Number(movement.amount) - assigned) * 100) / 100),
    }
  })

  const splittable = rows.filter((r) => SPLITTABLE.has(r.movement.kind))
  const pending = splittable.filter((r) => r.unassigned > 0)

  const categoryTotals = new Map<string, number>()
  for (const { allocations: own } of rows) {
    for (const a of own) {
      categoryTotals.set(a.category, (categoryTotals.get(a.category) ?? 0) + Number(a.amount))
    }
  }

  const fees = movements.filter((m) => m.kind === 'advance_fee')

  return {
    movements: rows,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, r) => sum + r.unassigned, 0),
    byCategory: [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    advanceFees: {
      total: fees.reduce((sum, m) => sum + Number(m.amount), 0),
      count: fees.length,
    },
  }
}
