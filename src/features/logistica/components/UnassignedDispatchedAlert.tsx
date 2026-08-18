'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignWarehouse } from '../services/assign-warehouse'
import type { Warehouse } from '@/types/database'

interface UnassignedRow {
  shipmentId: number
  deliveredAt: string | null
  fulfillmentType: string | null
}

const TYPE_LABEL: Record<string, string> = {
  flex: 'Flex',
  mercado_envios: 'Agencia',
  full: 'Full',
  other: 'Otro',
}

/**
 * Dispatched shipments nobody assigned a warehouse to. Until one is set they
 * count toward nobody's fortnight pay and their stock is never deducted —
 * which is exactly how 16 real shipments went missing before 2026-08-18. Shown
 * as a blocking-looking banner rather than a quiet list, because every row here
 * is money owed to someone and inventory that reads too high.
 */
export function UnassignedDispatchedAlert({
  rows,
  warehouses,
}: {
  rows: UnassignedRow[]
  warehouses: Warehouse[]
}) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<number | null>(null)

  if (rows.length === 0) return null

  async function handleAssign(shipmentId: number, warehouseId: string) {
    if (!warehouseId) return
    setSavingId(shipmentId)
    // orderId isn't needed to update an existing row — pass 0, the upsert keeps it.
    await assignWarehouse(shipmentId, 0, warehouseId)
    setSavingId(null)
    router.refresh()
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <h3 className="text-sm font-bold text-amber-900">
        {rows.length} {rows.length === 1 ? 'envío despachado sin bodega' : 'envíos despachados sin bodega'}
      </h3>
      <p className="mt-1 text-xs text-amber-800">
        Estos ya salieron pero nadie marcó quién los despachó. Mientras no lo asignes, no cuentan para el pago de la
        quincena ni descuentan inventario.
      </p>

      <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.shipmentId} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900">
                #{r.shipmentId}
                <span className="ml-2 font-normal text-gray-500">
                  {TYPE_LABEL[r.fulfillmentType ?? ''] ?? 'Sin tipo'}
                </span>
              </p>
              <p className="text-[11px] text-gray-400">
                {r.deliveredAt
                  ? new Date(r.deliveredAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                  : 'sin fecha'}
              </p>
            </div>
            <select
              defaultValue=""
              disabled={savingId === r.shipmentId}
              onChange={(e) => handleAssign(r.shipmentId, e.target.value)}
              className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value="">¿Quién lo despachó?</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
