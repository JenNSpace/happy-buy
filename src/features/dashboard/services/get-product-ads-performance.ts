import 'server-only'
import { mlGet } from './ml-client'
import { ML_SITE_ID } from '../constants'
import { getAdvertiserId } from './get-ads-summary'
import type { ProductAdsPerformance } from '../types'

interface MlAdItem {
  item_id: string
  title: string
  metrics: {
    clicks: number
    cost: number
    total_amount: number
  }
}

interface MlAdsSearchResponse {
  paging: { total: number; offset: number; limit: number }
  results: MlAdItem[]
}

/**
 * Per-product ad performance — Mercado Ads' campaign-level ROAS hides which
 * specific products the spend is actually working for. Ad-group duplicate
 * rows (same item_id + same ad_group_id, confirmed live) are deduped;
 * products with zero clicks/cost this period are dropped as noise (most of
 * this account's catalog sits paused/"hold" inside the campaign and was
 * never actually advertised).
 */
export async function getProductAdsPerformance(days = 7): Promise<ProductAdsPerformance[]> {
  const advertiserId = await getAdvertiserId()

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const path =
    `/marketplace/advertising/${ML_SITE_ID}/advertisers/${advertiserId}/product_ads/ads/search` +
    `?limit=50&offset=0&date_from=${fmt(from)}&date_to=${fmt(to)}&metrics=clicks,cost,total_amount`

  const data = await mlGet<MlAdsSearchResponse>(path, { 'api-version': '2' })

  const byItem = new Map<string, ProductAdsPerformance>()
  for (const item of data.results) {
    if (byItem.has(item.item_id)) continue
    if (item.metrics.clicks === 0 && item.metrics.cost === 0) continue

    byItem.set(item.item_id, {
      itemId: item.item_id,
      title: item.title,
      clicks: item.metrics.clicks,
      cost: item.metrics.cost,
      attributedSales: item.metrics.total_amount,
      roas: item.metrics.cost > 0 ? item.metrics.total_amount / item.metrics.cost : 0,
    })
  }

  return Array.from(byItem.values()).sort((a, b) => b.cost - a.cost)
}
