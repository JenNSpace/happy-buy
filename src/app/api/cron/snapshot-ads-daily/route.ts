import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { getAdvertiserId } from '@/features/dashboard/services/get-ads-summary'
import { ML_SITE_ID } from '@/features/dashboard/constants'

export const dynamic = 'force-dynamic'

interface MlCampaign {
  name: string
  budget: number
  roas_target: number
  metrics: { clicks: number; cost: number; total_amount: number }
}

interface MlCampaignsSearchResponse {
  results: MlCampaign[]
}

/**
 * Runs once a day via Vercel Cron (see vercel.json). Mercado Ads doesn't
 * retain historical budget/performance — this is our own record, going
 * forward, so we can eventually answer "did raising the budget pay off".
 * Snapshots the most recently *closed* day (yesterday, UTC) so the number
 * never changes after the fact.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const advertiserId = await getAdvertiserId()

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const dateStr = yesterday.toISOString().slice(0, 10)

  const path =
    `/marketplace/advertising/${ML_SITE_ID}/advertisers/${advertiserId}/product_ads/campaigns/search` +
    `?limit=50&offset=0&date_from=${dateStr}&date_to=${dateStr}&metrics=clicks,cost,total_amount&metrics_summary=true`

  const data = await mlGet<MlCampaignsSearchResponse>(path, { 'api-version': '2' })
  const campaign = data.results[0]

  if (!campaign) {
    return NextResponse.json({ skipped: true, reason: 'no active campaign' })
  }

  const { clicks, cost, total_amount } = campaign.metrics
  const roas = cost > 0 ? total_amount / cost : 0

  const supabase = createAdminClient()
  const { error } = await supabase.from('ads_daily_snapshots').upsert(
    {
      snapshot_date: dateStr,
      campaign_name: campaign.name,
      budget: campaign.budget,
      roas_target: campaign.roas_target,
      clicks,
      cost,
      total_amount,
      roas,
    },
    { onConflict: 'snapshot_date' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, date: dateStr, roas })
}
