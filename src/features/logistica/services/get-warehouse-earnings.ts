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

/** Builds one warehouse's fortnight: what ML confirmed, plus manual corrections. */
async function buildEarnings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  w: WarehouseRow,
  periodStart: string
): Promise<WarehouseEarnings> {
  const [{ data: shipments }, { data: adjustments }, { data: payment }] = await Promise.all([
    supabase
      .from('shipments')
      .select('delivered_at, fulfillment_type')
      .eq('warehouse_id', w.id)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', periodStart),
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

/**
 * Admin view: every warehouse that actually dispatches. Full is excluded —
 * Mercado Libre handles those end to end, nothing is ever assigned to it and
 * nobody is paid per package, so listing it as a payable bodega is noise.
 */
export async function getAllWarehouseEarningsThisMonth(): Promise<WarehouseEarnings[]> {
  const supabase = await createClient()
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_fulfillment', false)
    .order('name')
  if (!warehouses) return []

  const periodStart = getBogotaFortnightStart()
  return Promise.all(warehouses.map((w) => buildEarnings(supabase, w as WarehouseRow, periodStart)))
}
