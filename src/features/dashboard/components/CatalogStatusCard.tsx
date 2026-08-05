import { formatCOP } from '@/shared/utils/format'
import type { CatalogItem } from '../types'

export function CatalogStatusCard({ items }: { items: CatalogItem[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Publicaciones activas</h2>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-3 text-sm">
            <div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-gray-500">
                {item.soldQuantity} vendidas · {item.availableQuantity} en stock
              </p>
            </div>
            <span className="font-semibold text-gray-900">{formatCOP(item.price)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
