import { formatCOP } from '@/shared/utils/format'
import type { ProductAdsPerformance } from '../types'

export function ProductAdsPerformanceTable({
  items,
  breakEvenRoas,
}: {
  items: ProductAdsPerformance[]
  breakEvenRoas: number
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Ads por producto</h2>
        <p className="mt-2 text-sm text-gray-500">No hay gasto de ads en productos este período.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Ads por producto</h2>
      <p className="mb-4 text-xs text-gray-500">
        Qué producto realmente rinde con tu plata de ads — el ROAS de campaña esconde esto.
      </p>

      <div className="space-y-3">
        {items.map((item) => {
          const profitable = item.roas >= breakEvenRoas
          return (
            <div
              key={item.itemId}
              className="flex items-center justify-between border-b border-gray-100 pb-3 text-sm"
            >
              <div className="pr-4">
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-gray-500">
                  {item.clicks} clics · {formatCOP(item.cost)} gastado · {formatCOP(item.attributedSales)}{' '}
                  en ventas
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold ${profitable ? 'text-happy-greenDark' : 'text-red-600'}`}
              >
                {item.roas.toFixed(2)}x
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
