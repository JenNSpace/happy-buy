import { ProductThumbnail } from './ProductThumbnail'
import { plural } from '@/shared/utils/pluralize'
import { SURFACE_CARD, PILL, EYEBROW, HAIRLINE_T, HAIRLINE_B, HAIRLINE_L } from '@/shared/ui/surface'
import type { StockRow } from '../services/get-stock'
import type { Warehouse } from '@/types/database'

/**
 * Mismos colores de bodega que AdminLogisticsBoard — una bodega siempre se ve
 * igual en toda la app. Aquí el color viaja en dos piezas: la píldora del
 * encabezado (identidad) y un tinte muy leve en toda la columna (agrupación),
 * para que un número se lea pegado a su bodega sin subir la vista al título.
 */
const WAREHOUSE_THEMES = [
  { pill: 'bg-happy-green text-white', tint: 'bg-happy-green/[0.07]', dot: 'bg-happy-green' },
  { pill: 'bg-happy-lime text-gray-900', tint: 'bg-happy-lime/[0.10]', dot: 'bg-happy-lime' },
  { pill: 'bg-happy-greenDark text-white', tint: 'bg-happy-greenDark/[0.11]', dot: 'bg-happy-greenDark' },
]

const themeFor = (i: number) => WAREHOUSE_THEMES[i % WAREHOUSE_THEMES.length]

/** El ámbar ya no necesita leyenda aparte: la píldora dice qué es. */
const INCOMING_PILL =
  'mt-1.5 inline-flex items-center rounded-full bg-amber-100/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-700'

/**
 * Un 0 con reposición ya en camino no es la misma alerta que un 0 sin nada
 * llegando — el rojo se reserva para lo segundo, para que no pierda peso
 * cuando de verdad importa.
 */
const qtyColor = (qty: number, onTheWay: number) =>
  qty > 0 ? 'text-gray-900' : onTheWay > 0 ? 'text-gray-400' : 'text-red-500'

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

  /** Fila del producto ya resuelta: la usan la tabla y las tarjetas de celular. */
  const rows = products.map((product) => {
    const cells = warehouses.map((w) => ({
      warehouseId: w.id,
      qty: stockFor(product.id, w.id),
      onTheWay: incomingFor(product.id, w.id),
    }))
    return {
      product,
      cells,
      total: cells.reduce((sum, c) => sum + c.qty, 0),
      totalOnTheWay: cells.reduce((sum, c) => sum + c.onTheWay, 0),
    }
  })

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Stock actual</h3>

      {/* Escritorio: matriz producto × bodega, con el total como última columna. */}
      <div className={`hidden overflow-hidden md:block ${SURFACE_CARD}`}>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                scope="col"
                className={`${HAIRLINE_B} ${EYEBROW} px-5 py-3.5 text-left`}
              >
                Producto
              </th>
              {warehouses.map((w, i) => {
                const theme = themeFor(i)
                return (
                  <th key={w.id} scope="col" className={`${HAIRLINE_B} ${HAIRLINE_L} px-4 py-3.5 text-center ${theme.tint}`}>
                    <span className={`${PILL} ${theme.pill}`}>{w.name}</span>
                  </th>
                )
              })}
              <th scope="col" className={`${HAIRLINE_B} border-l border-l-gray-900/[0.12] bg-gray-50 px-5 py-3.5 text-center`}>
                <span className={`${PILL} bg-gray-900 text-white`}>Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, cells, total, totalOnTheWay }, rowIdx) => {
              const rowLine = rowIdx > 0 ? HAIRLINE_T : ''
              return (
                <tr key={product.id}>
                  <th scope="row" className={`px-5 py-4 text-left font-normal ${rowLine}`}>
                    <div className="flex items-center gap-3">
                      <ProductThumbnail src={photos[product.id]} alt={product.short_name} variant="soft" />
                      <div>
                        <div className="text-[15px] font-medium leading-tight text-gray-900">{product.short_name}</div>
                        <div className="mt-0.5 text-[13px] text-gray-400">{plural(product.base_unit)}</div>
                      </div>
                    </div>
                  </th>
                  {cells.map((cell, i) => (
                    <td
                      key={cell.warehouseId}
                      className={`${HAIRLINE_L} px-4 py-4 text-center align-middle ${themeFor(i).tint} ${rowLine}`}
                    >
                      <div
                        className={`text-[19px] font-semibold tabular-nums tracking-tight ${qtyColor(cell.qty, cell.onTheWay)}`}
                      >
                        {cell.qty}
                      </div>
                      {cell.onTheWay > 0 && <span className={INCOMING_PILL}>+{cell.onTheWay} en camino</span>}
                    </td>
                  ))}
                  <td className={`border-l border-l-gray-900/[0.12] bg-gray-50 px-5 py-4 text-center align-middle ${rowLine}`}>
                    <div className={`text-[24px] font-bold tabular-nums tracking-tight ${qtyColor(total, totalOnTheWay)}`}>
                      {total}
                    </div>
                    {totalOnTheWay > 0 && <span className={INCOMING_PILL}>+{totalOnTheWay} en camino</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: una tarjeta por producto — el total arriba, las bodegas debajo. */}
      <div className="space-y-3 md:hidden">
        {rows.map(({ product, cells, total, totalOnTheWay }) => (
          <div key={product.id} className={`overflow-hidden ${SURFACE_CARD}`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <ProductThumbnail src={photos[product.id]} alt={product.short_name} variant="soft" />
                <div>
                  <div className="text-[15px] font-medium leading-tight text-gray-900">{product.short_name}</div>
                  <div className="mt-0.5 text-[13px] text-gray-400">{plural(product.base_unit)}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-[24px] font-bold tabular-nums tracking-tight ${qtyColor(total, totalOnTheWay)}`}>
                  {total}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">total</div>
                {totalOnTheWay > 0 && <span className={INCOMING_PILL}>+{totalOnTheWay} en camino</span>}
              </div>
            </div>
            <div
              className={`grid divide-x divide-gray-900/[0.06] ${HAIRLINE_T}`}
              style={{ gridTemplateColumns: `repeat(${warehouses.length}, minmax(0, 1fr))` }}
            >
              {cells.map((cell, i) => {
                const theme = themeFor(i)
                return (
                  <div key={cell.warehouseId} className={`px-2 py-3 text-center ${theme.tint}`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}`} aria-hidden />
                      <span className="truncate text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
                        {warehouses[i].name}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 text-[19px] font-semibold tabular-nums tracking-tight ${qtyColor(cell.qty, cell.onTheWay)}`}
                    >
                      {cell.qty}
                    </div>
                    {cell.onTheWay > 0 && <span className={INCOMING_PILL}>+{cell.onTheWay} en camino</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
