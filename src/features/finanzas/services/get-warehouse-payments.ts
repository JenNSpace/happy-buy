import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Pagos a bodegas registrados en /logistica, para poder decir "este retiro
 * financió ESE pago".
 *
 * Enlazar NO agrega costo. Lo que la bodega se gana ya entró al P&L paquete por
 * paquete el día que se despachó (ver `bodegaFee` en get-pnl.ts); el pago solo
 * salda la cuenta corriente. El enlace existe para cerrar el hilo de la plata.
 */
export interface LinkableWarehousePayment {
  id: string
  warehouseName: string
  amount: number
  paidOn: string
  periodStart: string | null
  periodEnd: string | null
  /** Ya enlazado a otro retiro: se muestra pero no se puede volver a usar. */
  alreadyLinked: boolean
}

/** Ventana igual a la de los movimientos: cruzar un retiro con un pago de hace meses no tiene sentido. */
const WINDOW_DAYS = 45

interface Row {
  id: string
  amount: number
  paid_at: string
  period_start: string | null
  period_end: string | null
  warehouse: { name: string } | null
}

export async function getWarehousePayments(): Promise<LinkableWarehousePayment[]> {
  const supabase = await createClient()

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: rows }, { data: allocations }] = await Promise.all([
    supabase
      .from('warehouse_payments')
      .select('id, amount, paid_at, period_start, period_end, warehouse:warehouses(name)')
      .gte('paid_at', since)
      .order('paid_at', { ascending: false })
      .returns<Row[]>(),
    supabase.from('mp_allocations').select('warehouse_payment_id').not('warehouse_payment_id', 'is', null),
  ])

  const linked = new Set((allocations ?? []).map((a) => a.warehouse_payment_id as string))

  return (rows ?? []).map((p) => ({
    id: p.id,
    warehouseName: p.warehouse?.name ?? 'Bodega',
    amount: Number(p.amount),
    paidOn: p.paid_at.slice(0, 10),
    periodStart: p.period_start,
    periodEnd: p.period_end,
    alreadyLinked: linked.has(p.id),
  }))
}
