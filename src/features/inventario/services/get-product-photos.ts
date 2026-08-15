import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { createClient } from '@/lib/supabase/server'

interface MlItemThumbnail {
  thumbnail: string
}

/**
 * productId -> foto real de ML (misma que usa en su publicación). Un solo
 * ml_item_id por producto alcanza — todas las publicaciones de un mismo
 * producto muestran el mismo artículo físico. Productos sin ninguna
 * publicación mapeada (p.ej. uno recién escrito a mano en "Nueva compra")
 * simplemente no tienen entrada — el llamador debe mostrar un estado sin
 * foto, no asumir que todos los productos la tienen.
 */
export async function getProductPhotos(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: listings } = await supabase
    .from('product_listings')
    .select('ml_item_id, product_id')
    .returns<{ ml_item_id: string; product_id: string }[]>()

  if (!listings || listings.length === 0) return {}

  const oneListingPerProduct = new Map<string, string>()
  for (const l of listings) {
    if (!oneListingPerProduct.has(l.product_id)) oneListingPerProduct.set(l.product_id, l.ml_item_id)
  }

  const entries = await Promise.all(
    [...oneListingPerProduct.entries()].map(async ([productId, mlItemId]) => {
      try {
        const item = await mlGet<MlItemThumbnail>(`/items/${mlItemId}`)
        return [productId, item.thumbnail.replace(/^http:/, 'https:')] as const
      } catch {
        return null // una publicación caída/borrada no debe tumbar toda la página
      }
    })
  )

  const map: Record<string, string> = {}
  for (const entry of entries) {
    if (entry) map[entry[0]] = entry[1]
  }
  return map
}
