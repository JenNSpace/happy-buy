import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { getBogotaFortnightStart } from '../utils/dispatch-cutoff'

export interface FullProductLine {
  productId: string
  shortName: string
  stock: number
  soldThisFortnight: number
}

export interface FullSummary {
  warehouseId: string
  products: FullProductLine[]
  totalSold: number
  /** Real gross revenue of those sales, read per order from ML — never estimated. */
  revenue: number
}

/**
 * Mercado Libre Full: what's left in ML's warehouse, what sold out of it this
 * fortnight, and what that brought in.
 *
 * Kept out of the dispatch board entirely — nothing is ever assigned to Full
 * and nobody is paid per package, so it has no place among the warehouse
 * columns. It's shown as one tile beside the "Por enviar" tiles instead.
 *
 * Revenue is summed from each order's real `total_amount`, per the standing
 * rule that financial figures come from the individual sale, never an average.
 */
export async function getFullSummary(): Promise<FullSummary | null> {
  const supabase = await createClient()

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('id')
    .eq('is_fulfillment', true)
    .maybeSingle()

  if (!warehouse) return null

  const periodStart = getBogotaFortnightStart()

  const [{ data: movements }, { data: products }, { data: soldShipments }] = await Promise.all([
    supabase.from('inventory_movements').select('product_id, qty, type, created_at').eq('warehouse_id', warehouse.id),
    supabase.from('products').select('id, short_name'),
    supabase
      .from('shipments')
      .select('order_id')
      .eq('warehouse_id', warehouse.id)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', periodStart),
  ])

  const nameById = new Map((products ?? []).map((p) => [p.id as string, p.short_name as string]))

  const byProduct = new Map<string, { stock: number; sold: number }>()
  for (const m of movements ?? []) {
    const prev = byProduct.get(m.product_id) ?? { stock: 0, sold: 0 }
    prev.stock += m.qty
    if (m.type === 'salida_venta' && m.created_at >= periodStart) prev.sold += Math.abs(m.qty)
    byProduct.set(m.product_id, prev)
  }

  const lines = Array.from(byProduct.entries())
    .map(([productId, v]) => ({
      productId,
      shortName: nameById.get(productId) ?? '—',
      stock: v.stock,
      soldThisFortnight: v.sold,
    }))
    .sort((a, b) => a.shortName.localeCompare(b.shortName))

  let revenue = 0
  const orderIds = [...new Set((soldShipments ?? []).map((s) => s.order_id))]
  if (orderIds.length > 0) {
    const orders = await Promise.all(
      orderIds.map((id) =>
        mlGet<{ total_amount: number }>(`/orders/${id}`).catch(() => null)
      )
    )
    revenue = orders.reduce((sum, o) => sum + (o?.total_amount ?? 0), 0)
  }

  return {
    warehouseId: warehouse.id,
    products: lines,
    totalSold: lines.reduce((s, p) => s + p.soldThisFortnight, 0),
    revenue,
  }
}
