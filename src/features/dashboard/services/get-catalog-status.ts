import 'server-only'
import { mlGet } from './ml-client'
import { ML_USER_ID } from '../constants'
import type { CatalogItem } from '../types'

interface MlItemSearchResponse {
  results: string[]
}

interface MlItem {
  id: string
  title: string
  price: number
  sold_quantity: number
  available_quantity: number
  status: string
}

export async function getCatalogStatus(): Promise<CatalogItem[]> {
  const search = await mlGet<MlItemSearchResponse>(`/users/${ML_USER_ID}/items/search?status=active`)

  const items = await Promise.all(
    search.results.map((id) => mlGet<MlItem>(`/items/${id}`))
  )

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    price: item.price,
    soldQuantity: item.sold_quantity,
    availableQuantity: item.available_quantity,
    status: item.status,
  }))
}
