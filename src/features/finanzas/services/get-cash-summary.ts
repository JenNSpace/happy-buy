import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBogotaWeekStart } from '@/features/dashboard/lib/bogota-week'
import { HAPPY_BUY_COLLECTOR_ID } from './parse-payment'

export interface CashSummary {
  /** Plata vendida que ML todavía no libera, con fecha de liberación futura. */
  retenido: number
  /** Cuántas ventas la componen. */
  retenidoCount: number
  /** De lo retenido, lo que se libera antes del domingo. */
  entraEstaSemana: number
  entraEstaSemanaCount: number
  /**
   * Pagos cuya fecha de liberación YA PASÓ y que ML sigue reportando como
   * pendientes. Verificado contra la API el 2026-08-18: no es desincronización
   * nuestra, ML de verdad los retiene — uno desde noviembre de 2025. Se muestra
   * aparte porque sumarlo a "retenido" lo haría parecer plata en camino cuando
   * lleva meses trabada, y porque es lo único accionable de esta pantalla.
   */
  atrasado: number
  atrasadoCount: number
  /** El más viejo, para dimensionar el problema de un vistazo. */
  atrasadoDesde: string | null
  /** Compras registradas y no pagadas. */
  debes: number
  /** Nombre del método con más deuda, para la línea de apoyo. */
  debesPrincipal: string | null
  /** Si nunca se sincronizó nada, la UI muestra estado de carga en vez de $0. */
  sinDatos: boolean
}

/**
 * Las tres cifras del encabezado de /finanzas.
 *
 * Filtrar por `status = 'approved'` no es opcional: de los 1.441 pagos de la
 * cuenta, 72 rechazados y 25 cancelados quedan con `money_release_status =
 * 'pending'` para siempre. Sin ese filtro, "retenido" incluiría plata de ventas
 * que nunca ocurrieron.
 */
export async function getCashSummary(): Promise<CashSummary> {
  const supabase = createAdminClient()
  const weekEnd = new Date(getBogotaWeekStart())
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [{ data: pendientes, count }, { data: compras }] = await Promise.all([
    supabase
      .from('ml_payments')
      .select('net_received_amount, money_release_date', { count: 'exact' })
      .eq('status', 'approved')
      .eq('collector_id', HAPPY_BUY_COLLECTOR_ID)
      .eq('money_release_status', 'pending'),
    supabase
      .from('purchases')
      .select('total_cost, other_cost, payment_method_id, payment_methods(name)')
      .eq('paid', false),
  ])

  const rows = pendientes ?? []
  const now = new Date()
  let retenido = 0
  let retenidoCount = 0
  let entraEstaSemana = 0
  let entraEstaSemanaCount = 0
  let atrasado = 0
  let atrasadoCount = 0
  let atrasadoDesde: string | null = null

  for (const row of rows) {
    const amount = Number(row.net_received_amount)
    const release = row.money_release_date ? new Date(row.money_release_date) : null

    if (release && release < now) {
      atrasado += amount
      atrasadoCount += 1
      if (!atrasadoDesde || row.money_release_date! < atrasadoDesde) {
        atrasadoDesde = row.money_release_date!
      }
      continue
    }

    retenido += amount
    retenidoCount += 1
    if (release && release < weekEnd) {
      entraEstaSemana += amount
      entraEstaSemanaCount += 1
    }
  }

  // Deuda por método, para nombrar al principal sin inventar un ranking.
  const porMetodo = new Map<string, number>()
  let debes = 0
  for (const c of compras ?? []) {
    const monto = Number(c.total_cost) + Number(c.other_cost ?? 0)
    debes += monto
    const nombre =
      (c as unknown as { payment_methods?: { name?: string } }).payment_methods?.name ?? 'Sin método'
    porMetodo.set(nombre, (porMetodo.get(nombre) ?? 0) + monto)
  }

  const debesPrincipal =
    [...porMetodo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    retenido,
    retenidoCount,
    entraEstaSemana,
    entraEstaSemanaCount,
    atrasado,
    atrasadoCount,
    atrasadoDesde,
    debes,
    debesPrincipal,
    sinDatos: rows.length === 0 && (count ?? 0) === 0,
  }
}
