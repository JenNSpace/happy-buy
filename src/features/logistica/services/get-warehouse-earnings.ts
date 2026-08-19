import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getBogotaFortnightStart } from '../utils/dispatch-cutoff'

export interface DailyEarnings {
  date: string // YYYY-MM-DD, Bogotá local
  packages: number
  amount: number
}

export interface WarehouseAdjustment {
  id: string
  packagesDelta: number
  amountDelta: number
  note: string
}

export interface WarehouseEarnings {
  warehouseId: string
  warehouseName: string
  /** Inicio de la quincena, YYYY-MM-DD. */
  periodStart: string
  /** "1–15 de agosto". */
  periodLabel: string
  /** Una quincena ya cerrada que sigue sin pagarse. */
  isPastDue: boolean
  feePerPackageFlex: number
  feePerPackageAgencia: number
  daily: DailyEarnings[]
  /** Packages/amount ML confirmed on its own. */
  autoPackages: number
  autoAmount: number
  /** Manual corrections for this fortnight (extra packages, label printing, fixes). */
  adjustments: WarehouseAdjustment[]
  /** auto + adjustments — what's actually owed. */
  totalPackages: number
  totalAmount: number
  /** Set once the fortnight has been paid out. */
  paidAt: string | null
}

interface DeliveredShipment {
  delivered_at: string
  fulfillment_type: string | null
}

/**
 * Fee is per package dispatched, paid per FORTNIGHT — corrected 2026-08-18
 * (was monthly): Enrique pays "por quincena", and Daniel had already been
 * paid through 15-ago while Gina's previous fortnight was still outstanding.
 * Scoping to the current fortnight makes it reset itself when the period
 * rolls over. KNOWN GAP: a fortnight that closes unpaid disappears from this
 * view, because there is no payment record to compare against — see
 * getBogotaFortnightStart().
 *
 * Rate depends on HOW the package was dispatched, not who dispatched it
 * (confirmed by the user 2026-08-15): Flex (`self_service`, courier picks
 * up) pays less than a manual agencia/Mercado Envíos drop-off. Anything
 * that isn't specifically 'flex' — including null for shipments delivered
 * before this field existed — is billed at the agencia rate, since that's
 * the more common and more expensive case; undercounting the cheaper rate
 * would shortchange the person doing the work.
 */
function groupByBogotaDay(
  shipments: DeliveredShipment[],
  feePerPackageFlex: number,
  feePerPackageAgencia: number
): { daily: DailyEarnings[]; totalPackages: number; totalAmount: number } {
  const counts = new Map<string, { packages: number; amount: number }>()

  for (const s of shipments) {
    const bogotaDate = new Date(new Date(s.delivered_at).toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const key = `${bogotaDate.getFullYear()}-${String(bogotaDate.getMonth() + 1).padStart(2, '0')}-${String(bogotaDate.getDate()).padStart(2, '0')}`
    const fee = s.fulfillment_type === 'flex' ? feePerPackageFlex : feePerPackageAgencia
    const prev = counts.get(key) ?? { packages: 0, amount: 0 }
    counts.set(key, { packages: prev.packages + 1, amount: prev.amount + fee })
  }

  const daily = Array.from(counts.entries())
    .map(([date, { packages, amount }]) => ({ date, packages, amount }))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalPackages = daily.reduce((sum, d) => sum + d.packages, 0)
  const totalAmount = daily.reduce((sum, d) => sum + d.amount, 0)
  return { daily, totalPackages, totalAmount }
}

interface WarehouseRow {
  id: string
  name: string
  fee_per_package_flex: number
  fee_per_package_agencia: number
}

/** Fin de la quincena que arranca en `periodStart` (exclusivo), como instante ISO. */
function periodEnd(periodStart: string): string {
  const [y, m, d] = periodStart.slice(0, 10).split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')

  // Del 1: cierra el 16 del mismo mes. Del 16: cierra el 1 del mes siguiente.
  if (d === 1) return `${y}-${pad(m)}-16T00:00:00-05:00`
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  return `${nextYear}-${pad(nextMonth)}-01T00:00:00-05:00`
}

/** "1–15 de agosto" / "16–31 de agosto" para una quincena cualquiera. */
function labelFor(periodStart: string): string {
  const [y, m, d] = periodStart.slice(0, 10).split('-').map(Number)
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', {
    month: 'long',
    timeZone: 'UTC',
  })
  if (d === 1) return `1–15 de ${monthName}`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `16–${lastDay} de ${monthName}`
}

/** Builds one warehouse's fortnight: what ML confirmed, plus manual corrections. */
async function buildEarnings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  w: WarehouseRow,
  periodStart: string,
  isPastDue = false
): Promise<WarehouseEarnings> {
  const [{ data: shipments }, { data: adjustments }, { data: payment }] = await Promise.all([
    supabase
      .from('shipments')
      .select('delivered_at, fulfillment_type')
      .eq('warehouse_id', w.id)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', periodStart)
      // Una quincena cerrada tiene tope: sin esto, la del 1–15 se comería
      // también los envíos de la siguiente y pagaría dos veces lo mismo.
      .lt('delivered_at', periodEnd(periodStart)),
    supabase
      .from('warehouse_adjustments')
      .select('id, packages_delta, amount_delta, note')
      .eq('warehouse_id', w.id)
      .eq('period_start', periodStart.slice(0, 10)),
    supabase
      .from('warehouse_payments')
      .select('paid_at')
      .eq('warehouse_id', w.id)
      .eq('period_start', periodStart.slice(0, 10))
      .maybeSingle(),
  ])

  const { daily, totalPackages: autoPackages, totalAmount: autoAmount } = groupByBogotaDay(
    (shipments ?? []) as DeliveredShipment[],
    Number(w.fee_per_package_flex),
    Number(w.fee_per_package_agencia)
  )

  const adjusted = (adjustments ?? []).map((a) => ({
    id: a.id as string,
    packagesDelta: Number(a.packages_delta),
    amountDelta: Number(a.amount_delta),
    note: a.note as string,
  }))

  return {
    warehouseId: w.id,
    warehouseName: w.name,
    periodStart: periodStart.slice(0, 10),
    periodLabel: labelFor(periodStart),
    isPastDue,
    feePerPackageFlex: Number(w.fee_per_package_flex),
    feePerPackageAgencia: Number(w.fee_per_package_agencia),
    daily,
    autoPackages,
    autoAmount,
    adjustments: adjusted,
    totalPackages: autoPackages + adjusted.reduce((s, a) => s + a.packagesDelta, 0),
    totalAmount: autoAmount + adjusted.reduce((s, a) => s + a.amountDelta, 0),
    paidAt: (payment?.paid_at as string | undefined) ?? null,
  }
}

/** Bodega view: earnings for the caller's own warehouse, current fortnight only. */
export async function getMyWarehouseEarningsThisMonth(): Promise<WarehouseEarnings | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('warehouse_id').eq('id', user.id).single()
  if (!profile?.warehouse_id) return null

  const { data: warehouse } = await supabase.from('warehouses').select('*').eq('id', profile.warehouse_id).single()
  if (!warehouse) return null

  return buildEarnings(supabase, warehouse as WarehouseRow, getBogotaFortnightStart())
}

/** La quincena a la que pertenece una fecha, como YYYY-MM-DD. */
function fortnightOf(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const day = d.getDate() <= 15 ? '01' : '16'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`
}

/** Cuántos meses atrás mirar buscando quincenas impagas. */
const LOOKBACK_DAYS = 90

/**
 * Admin view: every warehouse that actually dispatches. Full is excluded —
 * Mercado Libre handles those end to end, nothing is ever assigned to it and
 * nobody is paid per package, so listing it as a payable bodega is noise.
 *
 * Devuelve la quincena en curso Y las anteriores que cerraron sin pagarse.
 * Antes solo mostraba la actual, y eso escondía plata real: el 2026-08-18 la
 * quincena del 1 al 15 de Gina tenía $47.600 sin pagar y no aparecía en ninguna
 * pantalla — pagando lo que se veía se le habría quedado debiendo. No se puede
 * pagar lo que no se ve.
 */
export async function getAllWarehouseEarningsThisMonth(): Promise<WarehouseEarnings[]> {
  const supabase = await createClient()
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_fulfillment', false)
    .order('name')
  if (!warehouses) return []

  const currentPeriod = getBogotaFortnightStart()
  const currentKey = currentPeriod.slice(0, 10)
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

  const [{ data: recent }, { data: payments }] = await Promise.all([
    supabase
      .from('shipments')
      .select('warehouse_id, delivered_at')
      .not('warehouse_id', 'is', null)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', since),
    supabase.from('warehouse_payments').select('warehouse_id, period_start'),
  ])

  const paid = new Set((payments ?? []).map((p) => `${p.warehouse_id}|${p.period_start}`))

  // Quincenas CERRADAS con envíos y sin pago registrado.
  const pending = new Set<string>()
  for (const s of recent ?? []) {
    const period = fortnightOf(s.delivered_at as string)
    if (period >= currentKey) continue
    const key = `${s.warehouse_id}|${period}`
    if (!paid.has(key)) pending.add(key)
  }

  const jobs: Promise<WarehouseEarnings>[] = []
  for (const w of warehouses) {
    // Las impagas primero: son las que reclaman una acción.
    const overdue = [...pending]
      .filter((k) => k.startsWith(`${w.id}|`))
      .map((k) => k.split('|')[1])
      .sort()
    for (const period of overdue) {
      jobs.push(buildEarnings(supabase, w as WarehouseRow, `${period}T00:00:00-05:00`, true))
    }
    jobs.push(buildEarnings(supabase, w as WarehouseRow, currentPeriod))
  }

  const all = await Promise.all(jobs)
  // Una quincena vieja sin plata pendiente no aporta nada; se oculta.
  return all.filter((e) => !e.isPastDue || e.totalAmount > 0)
}
