import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getBogotaMonthStart } from '../utils/dispatch-cutoff'

export interface DailyEarnings {
  date: string // YYYY-MM-DD, Bogotá local
  packages: number
  amount: number
}

export interface WarehouseEarnings {
  warehouseId: string
  warehouseName: string
  feePerPackage: number
  daily: DailyEarnings[]
  totalPackages: number
  totalAmount: number
}

/**
 * Fee is per package dispatched, paid monthly (confirmed by the user
 * 2026-08-06 — "ya que Julio ya se le pagó"). No separate payments table:
 * scoping every query to the current calendar month means it naturally
 * resets itself once the month rolls over — nothing to "mark as paid".
 */
function groupByBogotaDay(
  shipments: { delivered_at: string }[],
  feePerPackage: number
): { daily: DailyEarnings[]; totalPackages: number; totalAmount: number } {
  const counts = new Map<string, number>()

  for (const s of shipments) {
    const bogotaDate = new Date(new Date(s.delivered_at).toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const key = `${bogotaDate.getFullYear()}-${String(bogotaDate.getMonth() + 1).padStart(2, '0')}-${String(bogotaDate.getDate()).padStart(2, '0')}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const daily = Array.from(counts.entries())
    .map(([date, packages]) => ({ date, packages, amount: packages * feePerPackage }))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalPackages = daily.reduce((sum, d) => sum + d.packages, 0)
  return { daily, totalPackages, totalAmount: totalPackages * feePerPackage }
}

/** Bodega view: earnings for the caller's own warehouse, this month only. */
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

  const { data: shipments } = await supabase
    .from('shipments')
    .select('delivered_at')
    .eq('warehouse_id', profile.warehouse_id)
    .not('delivered_at', 'is', null)
    .gte('delivered_at', getBogotaMonthStart())

  const { daily, totalPackages, totalAmount } = groupByBogotaDay(
    (shipments ?? []) as { delivered_at: string }[],
    Number(warehouse.fee_per_package)
  )

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    feePerPackage: Number(warehouse.fee_per_package),
    daily,
    totalPackages,
    totalAmount,
  }
}

/** Admin view: every warehouse's earnings this month, so it's visible before the dedicated Finanzas tab exists. */
export async function getAllWarehouseEarningsThisMonth(): Promise<WarehouseEarnings[]> {
  const supabase = await createClient()
  const { data: warehouses } = await supabase.from('warehouses').select('*').order('name')
  if (!warehouses) return []

  return Promise.all(
    warehouses.map(async (w) => {
      const { data: shipments } = await supabase
        .from('shipments')
        .select('delivered_at')
        .eq('warehouse_id', w.id)
        .not('delivered_at', 'is', null)
        .gte('delivered_at', getBogotaMonthStart())

      const { daily, totalPackages, totalAmount } = groupByBogotaDay(
        (shipments ?? []) as { delivered_at: string }[],
        Number(w.fee_per_package)
      )

      return {
        warehouseId: w.id,
        warehouseName: w.name,
        feePerPackage: Number(w.fee_per_package),
        daily,
        totalPackages,
        totalAmount,
      }
    })
  )
}
