'use client'

import { useState } from 'react'
import { PurchaseForm } from './PurchaseForm'
import { ProductThumbnail } from './ProductThumbnail'
import { formatCOP } from '@/shared/utils/format'
import type { PaymentMethod, Product, Purchase, Warehouse } from '@/types/database'

/** Solo los estados "necesitan tu atención" llevan pill de color — lo ya resuelto se lee en texto discreto. */
function CheckText({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-happy-greenDark" fill="none" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  )
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export function PurchasesList({
  purchases,
  products,
  warehouses,
  paymentMethods,
  photos,
}: {
  purchases: Purchase[]
  products: Product[]
  warehouses: Warehouse[]
  paymentMethods: PaymentMethod[]
  photos: Record<string, string>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const productById = new Map(products.map((p) => [p.id, p]))
  const paymentMethodById = new Map(paymentMethods.map((m) => [m.id, m]))

  if (purchases.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no has registrado ninguna compra.</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Producto</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Compra</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-500">Cant.</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-500">Total</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Estado</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Pago</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {purchases.map((p) => {
              const product = productById.get(p.product_id)
              const paymentMethod = paymentMethodById.get(p.payment_method_id ?? '')
              const totalPedido = p.total_cost + p.other_cost
              const unitCost = totalPedido / p.quantity
              return (
                <tr key={p.id}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ProductThumbnail src={photos[p.product_id]} alt={product?.short_name ?? ''} />
                      <div>
                        <div className="font-medium text-gray-900">{product?.short_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{p.platform}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-500">{shortDate(p.created_at)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">{p.quantity}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-medium tabular-nums text-gray-900">{formatCOP(totalPedido)}</div>
                    <div className="text-xs tabular-nums text-gray-400">{p.quantity} × {formatCOP(unitCost)}</div>
                  </td>
                  <td className="px-3 py-3">
                    {p.status === 'pedido' ? (
                      <div>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          En camino
                        </span>
                        {p.eta && <div className="mt-1 text-xs text-gray-400">llega {shortDate(p.eta + 'T00:00:00')}</div>}
                      </div>
                    ) : (
                      <CheckText>Recibida</CheckText>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-gray-500">{paymentMethod?.name ?? '—'}</div>
                    {p.paid ? (
                      <CheckText>Pagado</CheckText>
                    ) : (
                      <span className="mt-0.5 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Se debe
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                      className="text-xs text-happy-green hover:underline"
                    >
                      {editingId === p.id ? 'Cerrar' : 'Editar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editingId && (
        <PurchaseForm
          products={products}
          warehouses={warehouses}
          paymentMethods={paymentMethods}
          photos={photos}
          purchase={purchases.find((p) => p.id === editingId)}
          onDone={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
