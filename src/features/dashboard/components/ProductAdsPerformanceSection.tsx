import { getProductAdsPerformance } from '../services/get-product-ads-performance'
import { breakEvenRoas } from '../constants'
import { ProductAdsPerformanceTable } from './ProductAdsPerformanceTable'

export async function ProductAdsPerformanceSection({ marginRate }: { marginRate: number }) {
  const items = await getProductAdsPerformance(7)
  return <ProductAdsPerformanceTable items={items} breakEvenRoas={breakEvenRoas(marginRate || 0.122)} />
}
