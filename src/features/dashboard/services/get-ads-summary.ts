import 'server-only'
import { mlGet } from './ml-client'
import { ML_SITE_ID, breakEvenRoas } from '../constants'
import type { AdsSummary } from '../types'

interface MlCampaign {
  id: number
  name: string
  status: string
  budget: number
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

export async function getAdsSummary(marginRate: number, days = 7): Promise<AdsSummary | null> {
  const advertiserId = await getAdvertiserId()

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const metrics = 'clicks,cost,total_amount'
  const path =
    `/advertising/${ML_SITE_ID}/advertisers/${advertiserId}/product_ads/campaigns/search` +
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
    clicks,
    cost,
    attributedSales: total_amount,
    roas,
    breakEvenRoas: breakeven,
    isLosingMoney: roas < breakeven,
  }
}
