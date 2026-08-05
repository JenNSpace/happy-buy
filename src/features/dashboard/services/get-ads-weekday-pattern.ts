import 'server-only'
import { mlGet } from './ml-client'
import { getAdvertiserId } from './get-ads-summary'
import { ML_SITE_ID } from '../constants'

export interface AdsWeekdayBucket {
  key: string
  label: string
  cost: number
  totalAmount: number
  clicks: number
  roas: number
}

interface MlCampaignMetrics {
  clicks: number
  cost: number
  total_amount: number
}

interface MlCampaignsSearchResponse {
  results: { metrics: MlCampaignMetrics }[]
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

async function fetchDayMetrics(advertiserId: number, date: Date): Promise<MlCampaignMetrics | null> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const path =
    `/advertising/${ML_SITE_ID}/advertisers/${advertiserId}/product_ads/campaigns/search` +
    `?limit=50&offset=0&date_from=${fmt(date)}&date_to=${fmt(date)}&metrics=clicks,cost,total_amount&metrics_summary=true`

  try {
    const data = await mlGet<MlCampaignsSearchResponse>(path, { 'api-version': '2' })
    return data.results.reduce(
      (acc, c) => ({
        clicks: acc.clicks + c.metrics.clicks,
        cost: acc.cost + c.metrics.cost,
        total_amount: acc.total_amount + c.metrics.total_amount,
      }),
      { clicks: 0, cost: 0, total_amount: 0 }
    )
  } catch {
    // A single failed day (rate limit, transient error) shouldn't break the whole pattern.
    return null
  }
}

/**
 * Mercado Ads' campaign search only returns an aggregate for whatever
 * date_from/date_to range is requested — there's no built-in daily
 * breakdown. To get a per-weekday pattern we query one day at a time (in
 * parallel; confirmed live this is fast, ~300ms per call) and bucket the
 * results ourselves.
 */
export async function getAdsWeekdayPattern(days = 30): Promise<AdsWeekdayBucket[]> {
  const advertiserId = await getAdvertiserId()

  const dates: Date[] = Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000))
  const results = await Promise.all(dates.map((d) => fetchDayMetrics(advertiserId, d)))

  const buckets: AdsWeekdayBucket[] = WEEKDAY_LABELS.map((label, i) => ({
    key: String(i),
    label,
    cost: 0,
    totalAmount: 0,
    clicks: 0,
    roas: 0,
  }))

  results.forEach((metrics, i) => {
    if (!metrics) return
    const jsDay = dates[i].getDay() // 0=Sun..6=Sat
    const weekday = (jsDay + 6) % 7 // 0=Mon..6=Sun
    buckets[weekday].cost += metrics.cost
    buckets[weekday].totalAmount += metrics.total_amount
    buckets[weekday].clicks += metrics.clicks
  })

  for (const b of buckets) {
    b.roas = b.cost > 0 ? b.totalAmount / b.cost : 0
  }

  return buckets
}
