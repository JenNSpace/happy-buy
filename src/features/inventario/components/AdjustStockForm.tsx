'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordAdjustment } from '../services/record-movement'
import type { Product, Warehouse } from '@/types/database'

export function AdjustStockForm({ products, warehouses }: { products: Product[]; warehouses: Warehouse[] }) {
  const router = useRouter()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(qty)
    if (!productId || !warehouseId || !parsed || parsed <= 0) {
      setMessage({ kind: 'error', text: 'Completa producto, bodega y una cantidad mayor a cero.' })
      return
    }

    setSaving(true)
    setMessage(null)
    const signedQty = direction === 'remove' ? -parsed : parsed
    const result = await recordAdjustment({ productId, warehouseId, qty: signedQty, note })
    setSaving(false)

    if (result?.error) {
      setMessage({ kind: 'error', text: result.error })
    } else {
      setMessage({ kind: 'ok', text: 'Ajuste registrado.' })
      setQty('')
      setNote('')
      router.refresh()
    }
  }

  return (
    <details className="rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700">
        Ajustar stock manualmente
      </summary>
      <p className="mt-1 text-xs text-gray-400">Para corregir un conteo — no para registrar compras ni ventas.</p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short_name}
              </option>
            ))}
          </select>

          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'add' | 'remove')}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="add">Agregar</option>
            <option value="remove">Quitar</option>
          </select>

          <input
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Cantidad"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Registrar ajuste'}
          </button>
          {message && (
            <span className={`text-xs ${message.kind === 'ok' ? 'text-happy-greenDark' : 'text-red-600'}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </details>
  )
}
