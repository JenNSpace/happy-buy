import { getAdsSummary } from '../services/get-ads-summary'
import { getProductMargin } from '../services/get-product-margin'
import { getRecommendations } from '../services/get-recommendations'
import { RecommendationsCard } from './RecommendationsCard'
import type { FinancialSummary } from '../types'

export async function RecommendationsSection({ summary }: { summary: FinancialSummary }) {
  const [ads, products] = await Promise.all([
    getAdsSummary(summary.marginRate || 0.122),
    getProductMargin(),
  ])

  const recommendations = getRecommendations(summary, ads, products)
  return <RecommendationsCard recommendations={recommendations} />
}
