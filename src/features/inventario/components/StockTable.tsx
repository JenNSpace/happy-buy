import { ProductThumbnail } from './ProductThumbnail'
import type { StockRow } from '../services/get-stock'
import type { Warehouse } from '@/types/database'

/** Mismos temas de color que AdminLogisticsBoard — una bodega siempre se ve igual en toda la app. */
const WAREHOUSE_THEMES = [
  { header: 'bg-happy-green', headerText: 'text-white' },
  { header: 'bg-happy-lime', headerText: 'text-gray-900' },
  { header: 'bg-happy-greenDark', headerText: 'text-white' },
]

export function StockTable({
  stock,
  warehouses,
  photos,
  incoming,
}: {
  stock: StockRow[]
  warehouses: Warehouse[]
  photos: Record<string, string>
  incoming: Record<string, number>
}) {
  const productIds = [...new Set(stock.map((s) => s.product.id))]
  const products = productIds
    .map((id) => stock.find((s) => s.product.id === id)!.product)
    .sort((a, b) => a.code.localeCompare(b.code))

  const stockFor = (productId: string, warehouseId: string) =>
    stock.find((s) => s.product.id === productId && s.warehouseId === warehouseId)?.stock ?? 0

  const incomingFor = (productId: string, warehouseId: string) => incoming[`${warehouseId}:${productId}`] ?? 0

  if (products.length === 0) {
    return <p className="text-sm text-gray-500">Sin movimientos de inventario todavía — registra una compra o un ajuste.</p>
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Stock actual</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {warehouses.map((w, i) => {
          const theme = WAREHOUSE_THEMES[i % WAREHOUSE_THEMES.length]
          return (
            <div key={w.id} className="overflow-hidden rounded-xl border-2 border-gray-100 bg-white shadow-sm">
              <div className={`px-4 py-2.5 ${theme.header} ${theme.headerText}`}>
                <h4 className="text-sm font-bold uppercase tracking-wide">{w.name}</h4>
              </div>
              <div className="divide-y divide-gray-100">
                {products.map((product) => {
                  const qty = stockFor(product.id, w.id)
                  const onTheWay = incomingFor(product.id, w.id)
                  // Un 0 con reposición ya en camino no es la misma alerta que un 0 sin nada llegando —
                  // el rojo se reserva para lo segundo, para que no pierda peso cuando de verdad importa.
                  const isStockOut = qty <= 0 && onTheWay === 0
                  return (
                    <div key={product.id} className="flex min-h-[52px] items-center justify-between gap-2 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProductThumbnail src={photos[product.id]} alt={product.short_name} />
                        <span className="text-sm text-gray-700">{product.short_name}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-base font-bold ${isStockOut ? 'text-red-500' : qty <= 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                          {qty}
                        </span>
                        <span className="ml-1 text-xs text-gray-400">disponibles</span>
                        <div className={`text-xs font-medium text-amber-700 ${onTheWay > 0 ? '' : 'invisible'}`}>
                          {onTheWay > 0 ? `${onTheWay} en camino` : '—'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="overflow-hidden rounded-xl border-2 border-gray-800 bg-white shadow-sm">
          <div className="bg-gray-800 px-4 py-2.5 text-white">
            <h4 className="text-sm font-bold uppercase tracking-wide">Total</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {products.map((product) => {
              const total = warehouses.reduce((sum, w) => sum + stockFor(product.id, w.id), 0)
              return (
                <div key={product.id} className="flex min-h-[52px] items-center justify-between gap-2 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProductThumbnail src={photos[product.id]} alt={product.short_name} />
                    <span className="text-sm text-gray-700">
                      {product.short_name} <span className="text-gray-400">({product.base_unit}s)</span>
                    </span>
                  </div>
                  <span className={`text-base font-bold ${total <= 0 ? 'text-red-500' : 'text-gray-900'}`}>{total}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
