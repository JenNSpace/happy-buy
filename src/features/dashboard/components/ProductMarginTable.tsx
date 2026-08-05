import { formatCOP, formatPercent } from '@/shared/utils/format'
import type { ProductMargin } from '../types'

export function ProductMarginTable({ items }: { items: ProductMargin[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Margen por producto</h2>
        <p className="mt-2 text-sm text-gray-500">No hay publicaciones activas.</p>
      </div>
    )
  }

  const avgMarginRate = items.reduce((sum, item) => sum + item.marginRate, 0) / items.length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Margen por producto</h2>

      <div className="space-y-3">
        {items.map((item) => {
          const belowAverage = item.marginRate < avgMarginRate - 0.02
          return (
            <div
              key={item.id}
              className="flex items-center justify-between border-b border-gray-100 pb-3 text-sm"
            >
              <div className="pr-4">
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-gray-500">
                  {formatCOP(item.price)} · {formatCOP(item.marginAmount)} de margen
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold ${belowAverage ? 'text-red-600' : 'text-happy-greenDark'}`}
              >
                {formatPercent(item.marginRate)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
