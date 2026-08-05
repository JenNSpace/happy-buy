import { getAdsSummary } from '../services/get-ads-summary'
import { Calculator } from './Calculator'
import type { FinancialSummary } from '../types'

export async function CalculatorSection({
  summary,
  avgUnitPrice,
}: {
  summary: FinancialSummary
  avgUnitPrice: number
}) {
  const ads = await getAdsSummary(summary.marginRate || 0.122)

  return <Calculator marginRate={summary.marginRate} avgUnitPrice={avgUnitPrice} ads={ads} />
}
