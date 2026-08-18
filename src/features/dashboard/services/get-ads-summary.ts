import 'server-only'
import { mlGet } from './ml-client'
import { ML_SITE_ID, breakEvenRoas } from '../constants'
import type { AdsSummary } from '../types'

interface MlCampaign {
  id: number
  name: string
  status: string
  budget: number
  roas_target: number
  metrics: {
    clicks: number
    cost: number
    total_amount: number
  }
}

interface MlCampaignsSearchResponse {
  results: MlCampaign[]
}

let cachedAdvertiserId: number | null = null

export async function getAdvertiserId(): Promise<number> {
  if (cachedAdvertiserId) return cachedAdvertiserId
  const data = await mlGet<{ advertisers: { advertiser_id: number }[] }>(
    '/advertising/advertisers?product_id=PADS'
  )
  const id = data.advertisers[0]?.advertiser_id
  if (!id) throw new Error('No se encontró un advertiser_id de Mercado Ads para esta cuenta.')
  cachedAdvertiserId = id
  return id
}

/**
 * Ad spend for an explicit window. The caller passes the SAME range used for
 * sales (see getCurrentWeekRange) — previously this defaulted to a rolling
 * 7 days while the profit card had moved to calendar weeks, so on a Tuesday
 * it subtracted a full week of ad spend from a day and a half of sales and
 * showed a profitable week as a loss (found live 2026-08-18).
 */
export async function getAdsSummary(
  marginRate: number,
  range: { from: Date; to: Date }
): Promise<AdsSummary | null> {
  const advertiserId = await getAdvertiserId()

  const { from, to } = range
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const metrics = 'clicks,cost,total_amount'
  const path =
    `/marketplace/advertising/${ML_SITE_ID}/advertisers/${advertiserId}/product_ads/campaigns/search` +
    `?limit=50&offset=0&date_from=${fmt(from)}&date_to=${fmt(to)}&metrics=${metrics}&metrics_summary=true`

  const data = await mlGet<MlCampaignsSearchResponse>(path, { 'api-version': '2' })
  const campaign = data.results[0]
  if (!campaign) return null

  const { clicks, cost, total_amount } = campaign.metrics
  const roas = cost > 0 ? total_amount / cost : 0
  const breakeven = breakEvenRoas(marginRate)

  return {
    campaignName: campaign.name,
    status: campaign.status,
    budget: campaign.budget,
    roasTarget: campaign.roas_target,
    clicks,
    cost,
    attributedSales: total_amount,
    roas,
    breakEvenRoas: breakeven,
    isLosingMoney: roas < breakeven,
  }
}
