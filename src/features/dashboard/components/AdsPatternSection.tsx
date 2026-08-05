import { getSalesHistory } from '../services/get-sales-history'
import { getAdsWeekdayPattern } from '../services/get-ads-weekday-pattern'
import { bucketSalesHistory } from '../lib/bucket-sales-history'
import { AdsPatternCard } from './AdsPatternCard'

export async function AdsPatternSection() {
  const [salesPoints, adsBuckets] = await Promise.all([
    getSalesHistory(30),
    getAdsWeekdayPattern(30),
  ])

  const salesBuckets = bucketSalesHistory(salesPoints, 'weekday', 'grossSales')

  return <AdsPatternCard salesBuckets={salesBuckets} adsBuckets={adsBuckets} />
}
