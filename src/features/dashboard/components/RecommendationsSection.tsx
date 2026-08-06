import { getProductMargin } from '../services/get-product-margin'
import { getRecommendations } from '../services/get-recommendations'
import { RecommendationsCard } from './RecommendationsCard'
import type { AdsSummary, FinancialSummary } from '../types'

export async function RecommendationsSection({
  summary,
  ads,
}: {
  summary: FinancialSummary
  ads: AdsSummary | null
}) {
  const products = await getProductMargin()
  const recommendations = getRecommendations(summary, ads, products)
  return <RecommendationsCard recommendations={recommendations} />
}
