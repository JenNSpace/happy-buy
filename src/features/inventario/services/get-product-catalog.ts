import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/types/database'

export interface ListingInfo {
  productId: string
  unitsPerSale: number
}

export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').order('code').returns<Product[]>()
  return data ?? []
}

/**
 * ml_item_id -> {productId, unitsPerSale}, loaded once per request and passed
 * down into computeOrderLineMetrics call sites (see dashboard/constants.ts) so
 * the pack-size source of truth lives in one DB-backed table instead of the
 * old hardcoded ITEM_PACK_SIZE map. `productId` also keys the real per-product
 * landed cost (see get-product-costs.ts).
 */
export async function getListingMap(): Promise<Map<string, ListingInfo>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_listings')
    .select('ml_item_id, product_id, units_per_sale')
    .returns<{ ml_item_id: string; product_id: string; units_per_sale: number }[]>()

  const map = new Map<string, ListingInfo>()
  for (const row of data ?? []) {
    map.set(row.ml_item_id, { productId: row.product_id, unitsPerSale: row.units_per_sale })
  }
  return map
}

/** What someone packing a box needs to know about one ML listing. */
export interface PackingInfo {
  /** products.short_name — ML's real titles are marketing copy, useless when packing fast. */
  shortName: string
  /** Physical units inside ONE sale of this listing. 3 for a "Pack X3". */
  unitsPerSale: number
  /** products.base_unit, singular: 'bolsa' | 'unidad'. */
  baseUnit: string
}

/**
 * ml_item_id -> what to pack. Plain Record (not Map) because this crosses into
 * Client Components (ProductLine and friends) as a prop.
 *
 * Carries `unitsPerSale` and not just the name because the name alone was
 * actively hiding the pack: a "Pack X3" listing renders as "Sal Céltica 454g",
 * identical to the single one, so the card told the bodega to pack 1 bag when
 * the buyer paid for 3. Measured 2026-08-19: 10 of the last 50 sales were pack
 * listings, and ML's own screen shows them as "1 unidad".
 *
 * A listing missing from `product_listings` is deliberately absent here rather
 * than defaulting to 1 — see `getPackingLine`, which flags it instead of
 * guessing. Guessing low is the expensive direction: it under-packs a paid
 * order.
 */
export async function getPackingMap(): Promise<Record<string, PackingInfo>> {
  const supabase = await createClient()
  const [{ data: products }, { data: listings }] = await Promise.all([
    supabase
      .from('products')
      .select('id, short_name, base_unit')
      .returns<{ id: string; short_name: string; base_unit: string }[]>(),
    supabase
      .from('product_listings')
      .select('ml_item_id, product_id, units_per_sale')
      .returns<{ ml_item_id: string; product_id: string; units_per_sale: number }[]>(),
  ])

  const productById = new Map((products ?? []).map((p) => [p.id, p]))
  const map: Record<string, PackingInfo> = {}
  for (const l of listings ?? []) {
    const product = productById.get(l.product_id)
    if (!product) continue
    map[l.ml_item_id] = {
      shortName: product.short_name,
      unitsPerSale: l.units_per_sale,
      baseUnit: product.base_unit,
    }
  }
  return map
}
