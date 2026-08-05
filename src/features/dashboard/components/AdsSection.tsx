import { getAdsSummary } from '../services/get-ads-summary'
import { AdsWarningCard } from './AdsWarningCard'

export async function AdsSection({ marginRate }: { marginRate: number }) {
  const ads = await getAdsSummary(marginRate)
  return <AdsWarningCard ads={ads} />
}
