import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Real landed cost per unit, per product — weighted average across every
 * purchase recorded for that product: total spent (product + taxes/shipping)
 * ÷ total units bought. Chosen over "price of the latest purchase" by the
 * user 2026-08-18 so a single expensive restock doesn't swing the margin.
 *
 * Replaces the old single hardcoded PRODUCT_COST_PER_UNIT_COP, which applied
 * Sal Céltica's cost to every product sold — a real distortion once the
 * catalog grew (Cable Ugreen really costs ~$24k/unit, not $34k).
 */
export async function getProductCostPerUnit(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('purchases')
    .select('product_id, quantity, total_cost, other_cost')
    .returns<{ product_id: string; quantity: number; total_cost: number; other_cost: number }[]>()

  const totals = new Map<string, { spent: number; units: number }>()
  for (const row of data ?? []) {
    const prev = totals.get(row.product_id) ?? { spent: 0, units: 0 }
    totals.set(row.product_id, {
      spent: prev.spent + Number(row.total_cost) + Number(row.other_cost),
      units: prev.units + row.quantity,
    })
  }

  const costPerUnit = new Map<string, number>()
  for (const [productId, { spent, units }] of totals) {
    if (units > 0) costPerUnit.set(productId, spent / units)
  }
  return costPerUnit
}
