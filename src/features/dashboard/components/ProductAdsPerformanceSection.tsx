import { getProductAdsPerformance } from '../services/get-product-ads-performance'
import { breakEvenRoas } from '../constants'
import { ProductAdsPerformanceTable } from './ProductAdsPerformanceTable'
import { friendlyErrorMessage } from '@/shared/utils/classify-error'

export async function ProductAdsPerformanceSection({ marginRate }: { marginRate: number }) {
  try {
    const items = await getProductAdsPerformance(7)
    return <ProductAdsPerformanceTable items={items} breakEvenRoas={breakEvenRoas(marginRate || 0.122)} />
  } catch (e) {
    const { title, body } = friendlyErrorMessage(e instanceof Error ? e : new Error('Error desconocido'))
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Ads por producto</h2>
        <p className="mt-2 text-sm font-medium text-amber-800">{title}</p>
        <p className="mt-1 text-sm text-amber-700">{body}</p>
      </div>
    )
  }
}
