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

/**
 * ml_item_id -> products.short_name. Plain Record (not Map) because this
 * crosses into Client Components (ProductLine and friends) as a prop.
 */
export async function getShortNameMap(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const [{ data: products }, { data: listings }] = await Promise.all([
    supabase.from('products').select('id, short_name').returns<{ id: string; short_name: string }[]>(),
    supabase.from('product_listings').select('ml_item_id, product_id').returns<{ ml_item_id: string; product_id: string }[]>(),
  ])

  const nameById = new Map((products ?? []).map((p) => [p.id, p.short_name]))
  const map: Record<string, string> = {}
  for (const l of listings ?? []) {
    const name = nameById.get(l.product_id)
    if (name) map[l.ml_item_id] = name
  }
  return map
}
