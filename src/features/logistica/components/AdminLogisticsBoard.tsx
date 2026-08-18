'use client'

import { useEffect, useMemo, useState } from 'react'
import { assignWarehouse } from '../services/assign-warehouse'
import { Countdown } from './Countdown'
import { UrgencyBanner } from './UrgencyBanner'
import { FulfillmentBadge, FULFILLMENT_BORDER_STYLE, FULFILLMENT_CARD_BG } from './FulfillmentBadge'
import { DispatchSummaryTiles } from './DispatchSummaryTiles'
import { ProductLine } from './ProductLine'
import { getDispatchMessage } from '../utils/dispatch-cutoff'
import { getCountdownInfo } from '../utils/countdown'
import type { PendingShipment } from '../types'
import type { FullSummary } from '../services/get-full-summary'
import type { Warehouse } from '@/types/database'

/** Most urgent first (overdue counts as "most urgent"); items with no deadline sort last. */
function sortByUrgency(shipments: PendingShipment[]): PendingShipment[] {
  return [...shipments].sort((a, b) => {
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    if (a.deadline) return -1
    if (b.deadline) return 1
    return 0
  })
}

function SummaryCounts({
  shipments,
  byWarehouse,
}: {
  shipments: PendingShipment[]
  byWarehouse: { warehouse: Warehouse; items: PendingShipment[] }[]
}) {
  const unprinted = shipments.filter((s) => !s.printed).length

  const parts = [
    `${shipments.length} pendiente${shipments.length === 1 ? '' : 's'}`,
    ...byWarehouse.map(({ warehouse, items }) => `${items.length} en ${warehouse.name}`),
    `${unprinted} sin imprimir`,
  ]

  return <p className="text-sm text-gray-500">{parts.join(' · ')}</p>
}

interface ColumnTheme {
  header: string
  headerText: string
  badgeBg: string
  badgeText: string
  accentBorder: string
}

const UNASSIGNED_THEME: ColumnTheme = {
  header: 'bg-gray-800',
  headerText: 'text-white',
  badgeBg: 'bg-white/15',
  badgeText: 'text-white',
  accentBorder: 'border-gray-800',
}

const WAREHOUSE_THEMES: ColumnTheme[] = [
  {
    header: 'bg-happy-green',
    headerText: 'text-white',
    badgeBg: 'bg-white/20',
    badgeText: 'text-white',
    accentBorder: 'border-happy-green',
  },
  {
    header: 'bg-happy-lime',
    headerText: 'text-gray-900',
    badgeBg: 'bg-gray-900/10',
    badgeText: 'text-gray-900',
    accentBorder: 'border-happy-lime',
  },
  {
    header: 'bg-happy-greenDark',
    headerText: 'text-white',
    badgeBg: 'bg-white/20',
    badgeText: 'text-white',
    accentBorder: 'border-happy-greenDark',
  },
]

function ShipmentCard({
  shipment,
  warehouses,
  shortNames,
}: {
  shipment: PendingShipment
  warehouses: Warehouse[]
  shortNames: Record<string, string>
}) {
  const [warehouseId, setWarehouseId] = useState(shipment.warehouseId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(() => getCountdownInfo(shipment.deadline))

  useEffect(() => {
    const interval = setInterval(() => setCountdown(getCountdownInfo(shipment.deadline)), 60_000)
    return () => clearInterval(interval)
  }, [shipment.deadline])

  const isOverdue = countdown.tier === 'overdue'
  const dispatchMessage = getDispatchMessage(shipment.fulfillmentType, isOverdue)

  async function handleChange(nextWarehouseId: string) {
    const previous = warehouseId
    setWarehouseId(nextWarehouseId)
    setSaving(true)
    setError(null)

    const result = await assignWarehouse(shipment.shipmentId, shipment.orderId, nextWarehouseId || null)

    setSaving(false)
    if (result?.error) {
      setWarehouseId(previous)
      setError(result.error)
    } else {
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2000)
    }
  }

  return (
    <div
      className={`border-b border-l-4 border-gray-100 p-4 last:border-b-0 ${FULFILLMENT_BORDER_STYLE[shipment.fulfillmentType]} ${FULFILLMENT_CARD_BG[shipment.fulfillmentType]}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FulfillmentBadge type={shipment.fulfillmentType} />
          {shipment.printed && <span className="text-[10px] font-medium text-gray-400">🖨 Etiqueta impresa</span>}
        </div>
        <span className="text-[11px] text-gray-400">{shipment.buyerNickname}</span>
      </div>

      {/* Never hide a shipment we couldn't classify — make the human check it. */}
      {shipment.dispatchState === 'unknown' && (
        <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
          Estado no reconocido — confirma en Mercado Libre antes de despacharlo.
        </p>
      )}

      <div className="mb-2 space-y-1.5">
        {shipment.items.map((item, i) => (
          <div key={i}>
            <ProductLine itemId={item.itemId} title={item.title} quantity={item.quantity} shortNames={shortNames} />
            {(item.attributes || item.sku) && (
              <p className="ml-11 text-[11px] text-gray-400">
                {item.attributes}
                {item.attributes && item.sku ? ' · ' : ''}
                {item.sku ? `SKU: ${item.sku}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {new Date(shipment.dateCreated).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
        </span>
        <Countdown deadline={shipment.deadline} />
      </div>

      {dispatchMessage && (
        <p className={`mb-1 text-[11px] ${isOverdue ? 'font-medium text-red-600' : 'text-gray-500'}`}>
          {dispatchMessage}
        </p>
      )}
      <p className={`mb-3 text-[11px] ${isOverdue ? 'font-semibold text-red-600' : 'text-gray-400'}`}>
        {isOverdue ? '⚠ Afecta tu reputación' : 'No afecta tu reputación'}
      </p>

      <div className="flex items-center gap-2">
        <select
          value={warehouseId}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green disabled:opacity-50"
        >
          <option value="">Sin asignar</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <a
          href={`/api/shipping/label/${shipment.shipmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap text-sm text-happy-green hover:underline"
        >
          {shipment.printed ? 'Reimprimir etiqueta' : 'Imprimir etiqueta'}
        </a>
      </div>

      <div className="mt-1 h-4 text-xs">
        {saving && <span className="text-gray-400">Guardando...</span>}
        {savedAt && <span className="text-happy-greenDark">✓ Guardado</span>}
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </div>
  )
}

function ShipmentColumn({
  title,
  items,
  warehouses,
  emptyLabel,
  theme,
  shortNames,
}: {
  title: string
  items: PendingShipment[]
  warehouses: Warehouse[]
  emptyLabel: string
  theme: ColumnTheme
  shortNames: Record<string, string>
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border-2 ${theme.accentBorder} bg-white shadow-sm`}>
      <div className={`flex items-center justify-between px-4 py-3 ${theme.header} ${theme.headerText}`}>
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${theme.badgeBg} ${theme.badgeText}`}>
          {items.length}
        </span>
      </div>

      <div className="max-h-[65vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="p-4 text-xs text-gray-400">{emptyLabel}</p>
        ) : (
          items.map((s) => <ShipmentCard key={s.shipmentId} shipment={s} warehouses={warehouses} shortNames={shortNames} />)
        )}
      </div>
    </div>
  )
}

export function AdminLogisticsBoard({
  shipments,
  warehouses,
  shortNames,
  fullSummary,
}: {
  shipments: PendingShipment[]
  warehouses: Warehouse[]
  shortNames: Record<string, string>
  fullSummary: FullSummary | null
}) {
  const groups = useMemo(() => {
    const unassigned = sortByUrgency(shipments.filter((s) => !s.warehouseId))
    const byWarehouse = warehouses.map((w) => ({
      warehouse: w,
      items: sortByUrgency(shipments.filter((s) => s.warehouseId === w.id)),
    }))
    return { unassigned, byWarehouse }
  }, [shipments, warehouses])

  if (shipments.length === 0) {
    return (
      <div className="space-y-6">
        <DispatchSummaryTiles shipments={shipments} fullSummary={fullSummary} />
        <p className="text-sm text-gray-500">No hay pedidos pendientes de entrega.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DispatchSummaryTiles shipments={shipments} fullSummary={fullSummary} />

      <SummaryCounts shipments={shipments} byWarehouse={groups.byWarehouse} />

      <UrgencyBanner deadlines={shipments.map((s) => s.deadline)} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <ShipmentColumn
          title="Sin asignar"
          items={groups.unassigned}
          warehouses={warehouses}
          emptyLabel="Todo lo pendiente ya tiene bodega asignada."
          theme={UNASSIGNED_THEME}
          shortNames={shortNames}
        />

        {groups.byWarehouse.map(({ warehouse, items }, i) => (
          <ShipmentColumn
            key={warehouse.id}
            title={warehouse.name}
            items={items}
            warehouses={warehouses}
            emptyLabel="Nada asignado a esta bodega por ahora."
            theme={WAREHOUSE_THEMES[i % WAREHOUSE_THEMES.length]}
            shortNames={shortNames}
          />
        ))}
      </div>
    </div>
  )
}
