import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { HAPPY_BUY_COLLECTOR_ID } from './parse-payment'

export interface CashFlowWeek {
  key: string
  label: string
  amount: number
  count: number
}

export interface CashFlowDeposit {
  /** Fecha de liberación, YYYY-MM-DD. */
  date: string
  amount: number
  count: number
  /** Rango de fechas de las ventas que lo componen, para dar contexto. */
  soldOn: string
}

export interface CashFlow {
  weeks: CashFlowWeek[]
  deposits: CashFlowDeposit[]
  /** Mediana real de días entre la venta y su liberación. Null si no hay datos. */
  medianDelayDays: number | null
  totalPending: number
}

const DAY_MS = 86_400_000

function bogotaDate(iso: string): Date {
  return new Date(iso)
}

/** Lunes de la semana que contiene `d`, como YYYY-MM-DD. */
function weekKey(d: Date): string {
  const monday = new Date(d)
  const day = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1))
  return monday.toISOString().slice(0, 10)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

function formatDayMonth(d: Date): string {
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
}

/**
 * Cuándo entra la plata que ML todavía retiene.
 *
 * El plazo de retención se CALCULA a partir de los datos, nunca se escribe: era
 * de 3 a 13 días en 2025 y hoy son 21. Un texto fijo mentiría en silencio el día
 * que ML lo vuelva a mover, que ya demostró que hace.
 *
 * Solo cuenta pagos `approved`: rechazados y cancelados se quedan en `pending`
 * para siempre y sumarían plata inexistente.
 */
export async function getCashFlow(): Promise<CashFlow> {
  const supabase = createAdminClient()

  // Solo lo que está por venir. Hay pagos que ML sigue marcando como pendientes
  // con fecha ya vencida (verificado contra la API el 2026-08-18: uno desde
  // noviembre de 2025) — pintarlos aquí llenaría de barras el pasado en una
  // sección que responde "cuándo entra". Se muestran aparte, en el encabezado.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('ml_payments')
    .select('net_received_amount, money_release_date, date_approved')
    .eq('status', 'approved')
    // Sin este filtro entran las compras de Jen: la API devuelve lo que cobra y
    // lo que paga en la misma lista.
    .eq('collector_id', HAPPY_BUY_COLLECTOR_ID)
    .eq('money_release_status', 'pending')
    .gte('money_release_date', today.toISOString())
    .order('money_release_date', { ascending: true })

  const rows = data ?? []
  if (rows.length === 0) {
    return { weeks: [], deposits: [], medianDelayDays: null, totalPending: 0 }
  }

  const delays: number[] = []
  const byWeek = new Map<string, { amount: number; count: number }>()
  const byDay = new Map<string, { amount: number; count: number; soldFrom: Date; soldTo: Date }>()
  let totalPending = 0

  for (const row of rows) {
    const amount = Number(row.net_received_amount)
    const release = bogotaDate(row.money_release_date!)
    totalPending += amount

    if (row.date_approved) {
      const approved = bogotaDate(row.date_approved)
      delays.push(Math.round((release.getTime() - approved.getTime()) / DAY_MS))
    }

    const wk = weekKey(release)
    const w = byWeek.get(wk) ?? { amount: 0, count: 0 }
    byWeek.set(wk, { amount: w.amount + amount, count: w.count + 1 })

    const dayKey = release.toISOString().slice(0, 10)
    const sold = row.date_approved ? bogotaDate(row.date_approved) : release
    const d = byDay.get(dayKey)
    if (d) {
      byDay.set(dayKey, {
        amount: d.amount + amount,
        count: d.count + 1,
        soldFrom: sold < d.soldFrom ? sold : d.soldFrom,
        soldTo: sold > d.soldTo ? sold : d.soldTo,
      })
    } else {
      byDay.set(dayKey, { amount, count: 1, soldFrom: sold, soldTo: sold })
    }
  }

  // Escala continua desde esta semana hasta la última con depósitos, incluidas
  // las vacías: saltarse una semana sin plata comprimiría el eje y haría ver
  // como "la próxima" algo que está a tres semanas.
  const firstWeek = weekKey(new Date())
  const lastWeek = [...byWeek.keys()].sort().at(-1) ?? firstWeek

  const weeks: CashFlowWeek[] = []
  const cursor = new Date(`${firstWeek}T00:00:00Z`)
  const end = new Date(`${lastWeek}T00:00:00Z`)

  while (cursor <= end && weeks.length < 26) {
    const key = cursor.toISOString().slice(0, 10)
    const v = byWeek.get(key)
    weeks.push({
      key,
      label: weeks.length === 0 ? 'esta' : formatDayMonth(cursor),
      amount: v?.amount ?? 0,
      count: v?.count ?? 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  const deposits: CashFlowDeposit[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      const from = formatDayMonth(v.soldFrom)
      const to = formatDayMonth(v.soldTo)
      return {
        date,
        amount: v.amount,
        count: v.count,
        soldOn: from === to ? from : `${from} a ${to}`,
      }
    })

  return { weeks, deposits, medianDelayDays: median(delays), totalPending }
}
