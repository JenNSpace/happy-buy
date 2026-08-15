import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { ML_USER_ID } from '@/features/dashboard/constants'
import { createAdminClient } from '@/lib/supabase/admin'

interface MlItemSearchResponse {
  results: string[]
}

interface MlItemDetail {
  id: string
  title: string
  user_product_id: string | null
}

export interface UnmappedListing {
  mlItemId: string
  title: string
}

/**
 * Enrique republishes the same physical product under new listings for
 * search-keyword coverage (confirmed by the user 2026-08-14) — a fixed list
 * of item ids WILL silently miss real sales. Meant to run on every /compras
 * admin load.
 *
 * A new active listing under a user_product_id we already know (i.e. ML's
 * own "synced listing" grouping) is auto-linked to that same product — same
 * physical item, just another storefront page, no ambiguity. A listing
 * under a genuinely new user_product_id can't be guessed at (which product
 * is it? what's units_per_sale?) and is returned for a human to map instead
 * of silently skipped, since silently skipping would mean its sales never
 * decrement inventory.
 */
export async function discoverListings(): Promise<UnmappedListing[]> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('product_listings')
    .select('ml_item_id, user_product_id, product_id')
    .returns<{ ml_item_id: string; user_product_id: string; product_id: string }[]>()

  const known = new Set((existing ?? []).map((l) => l.ml_item_id))
  const productByUserProductId = new Map((existing ?? []).map((l) => [l.user_product_id, l.product_id]))

  const search = await mlGet<MlItemSearchResponse>(`/users/${ML_USER_ID}/items/search?status=active`)
  const newIds = search.results.filter((id) => !known.has(id))
  if (newIds.length === 0) return []

  const details = await Promise.all(newIds.map((id) => mlGet<MlItemDetail>(`/items/${id}`)))

  const toAutoMap = details.filter((d) => d.user_product_id && productByUserProductId.has(d.user_product_id))
  const unmapped = details.filter((d) => !d.user_product_id || !productByUserProductId.has(d.user_product_id))

  if (toAutoMap.length > 0) {
    await supabase.from('product_listings').insert(
      toAutoMap.map((d) => ({
        ml_item_id: d.id,
        user_product_id: d.user_product_id!,
        product_id: productByUserProductId.get(d.user_product_id!)!,
        units_per_sale: 1,
        auto_mapped: true,
      }))
    )
  }

  return unmapped.map((d) => ({ mlItemId: d.id, title: d.title }))
}
