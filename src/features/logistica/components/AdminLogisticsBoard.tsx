'use client'

import { useEffect, useMemo, useState } from 'react'
import { assignWarehouse } from '../services/assign-warehouse'
import { UrgencyBanner } from './UrgencyBanner'
import { FulfillmentBadge, FULFILLMENT_BORDER_STYLE, FULFILLMENT_CARD_BG } from './FulfillmentBadge'
import { DispatchSummaryTiles } from './DispatchSummaryTiles'
import { ProductLine } from './ProductLine'
import type { PackingMap } from '../utils/product-name'
import { getDispatchMessage } from '../utils/dispatch-cutoff'
import { getCountdownInfo, TIER_TEXT_STYLE, TIER_ICON, URGENCY_BOX_STYLE } from '../utils/countdown'
import type { PendingShipment } from '../types'
import type { FullSummary } from '../services/get-full-summary'
import type { Warehouse } from '@/types/database'
import { SURFACE_CARD_RINGLESS, HAIRLINE_T, SCROLL_THIN, BUTTON_GHOST } from '@/shared/ui/surface'

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
  /** Anillo del contenedor. Va aparte del `ring-1` de SURFACE_CARD_RINGLESS. */
  ring: string
}

const UNASSIGNED_THEME: ColumnTheme = {
  header: 'bg-gray-800',
  headerText: 'text-white',
  badgeBg: 'bg-white/15',
  badgeText: 'text-white',
  ring: 'ring-gray-900/20',
}

const WAREHOUSE_THEMES: ColumnTheme[] = [
  {
    header: 'bg-happy-green',
    headerText: 'text-white',
    badgeBg: 'bg-white/20',
    badgeText: 'text-white',
    ring: 'ring-happy-green/40',
  },
  {
    header: 'bg-happy-lime',
    headerText: 'text-gray-900',
    badgeBg: 'bg-gray-900/10',
    badgeText: 'text-gray-900',
    ring: 'ring-happy-lime/50',
  },
  {
    header: 'bg-happy-greenDark',
    headerText: 'text-white',
    badgeBg: 'bg-white/20',
    badgeText: 'text-white',
    ring: 'ring-happy-greenDark/40',
  },
]

function ShipmentCard({
  shipment,
  warehouses,
  packing,
}: {
  shipment: PendingShipment
  warehouses: Warehouse[]
  packing: PackingMap
}) {
  const [warehouseId, setWarehouseId] = useState(shipment.warehouseId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(() =>
    getCountdownInfo(shipment.deadline, new Date(), { isLate: shipment.isLate })
  )

  useEffect(() => {
    const interval = setInterval(
      () => setCountdown(getCountdownInfo(shipment.deadline, new Date(), { isLate: shipment.isLate })),
      60_000
    )
    return () => clearInterval(interval)
  }, [shipment.deadline, shipment.isLate])

  const isOverdue = countdown.tier === 'overdue'
  // Nuestro corte ya pasó, con o sin alarma de ML: el texto tiene que dejar de
  // decir "hoy" en los dos casos.
  const pastCutoff = isOverdue || countdown.tier === 'next_round'
  const dispatchMessage = getDispatchMessage(shipment.fulfillmentType, shipment.deadline, pastCutoff)

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
      className={`border-b border-b-gray-900/[0.07] border-l-4 p-4 last:border-b-0 ${FULFILLMENT_BORDER_STYLE[shipment.fulfillmentType]} ${FULFILLMENT_CARD_BG[shipment.fulfillmentType]}`}
    >
      {/* ZONA 1 — contexto. Una sola línea que nunca se parte: sin `shrink-0` y
          `truncate` un nickname largo en mayúsculas empujaba el badge del canal
          a dos renglones y desordenaba la tarjeta entera. */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="shrink-0">
          <FulfillmentBadge type={shipment.fulfillmentType} />
        </div>
        <span className="min-w-0 truncate text-[11px] text-gray-400" title={shipment.buyerNickname}>
          {shipment.buyerNickname}
        </span>
      </div>

      {/* Never hide a shipment we couldn't classify — make the human check it. */}
      {shipment.dispatchState === 'unknown' && (
        <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
          Estado no reconocido — confirma en Mercado Libre antes de despacharlo.
        </p>
      )}

      {/* ZONA 2 — qué empacar. Es la única acción física de la tarjeta, así que
          manda: nada más en la tarjeta compite en tamaño con esto. */}
      <div className="mb-3 space-y-1.5">
        {shipment.items.map((item, i) => (
          <ProductLine key={i} itemId={item.itemId} title={item.title} quantity={item.quantity} packing={packing} />
        ))}
      </div>

      {/* ZONA 3 — cuándo. Solo toma superficie de color cuando hay algo que
          avisar; en el caso normal es texto plano. El silencio es la señal de
          que todo va bien. */}
      <div className={`mb-3 ${URGENCY_BOX_STYLE[countdown.tier]}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-2">
          <span className="whitespace-nowrap text-xs text-gray-500">
            {new Date(shipment.dateCreated).toLocaleString('es-CO', {
              day: '2-digit',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/Bogota',
            })}
          </span>
          <span className={`whitespace-nowrap text-sm font-semibold ${TIER_TEXT_STYLE[countdown.tier]}`}>
            {TIER_ICON[countdown.tier]} {countdown.label}
          </span>
        </div>
        {dispatchMessage && (
          <p className={`mt-1 text-xs ${isOverdue ? 'font-medium text-red-700' : 'text-gray-500'}`}>
            {dispatchMessage}
          </p>
        )}
      </div>

      {/* Solo cuando ML dice que SÍ pega. Anunciar "no afecta tu reputación" en
          el caso bueno le enseña al ojo a saltarse este bloque, y entonces el
          aviso que sí importa pasa desapercibido. Va aparte de la caja de
          urgencia porque son señales independientes: ML puede darlo por on_time
          con nuestro corte ya vencido, y al revés. */}
      {shipment.isLate && (
        <p className="mb-3 text-xs font-bold text-red-700">⚠ Afecta tu reputación</p>
      )}

      {/* ZONA 4 — acción, separada por un hairline. Asignar bodega es lo
          principal acá; imprimir queda en segundo plano pero con área de toque
          suficiente para el celular. */}
      <div className={`flex items-center gap-2 pt-3 ${HAIRLINE_T}`}>
        <select
          value={warehouseId}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className={`min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green disabled:opacity-50 ${
            warehouseId ? 'border-gray-300 text-gray-900' : 'border-dashed border-gray-400 text-gray-500'
          }`}
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
          className={`shrink-0 whitespace-nowrap ${BUTTON_GHOST}`}
        >
          {shipment.printed ? 'Reimprimir' : 'Imprimir'}
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
  packing,
}: {
  title: string
  items: PendingShipment[]
  warehouses: Warehouse[]
  emptyLabel: string
  theme: ColumnTheme
  packing: PackingMap
}) {
  return (
    <div className={`flex flex-col overflow-hidden ${SURFACE_CARD_RINGLESS} ${theme.ring}`}>
      <div className={`flex items-center justify-between px-4 py-3 ${theme.header} ${theme.headerText}`}>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.06em]">{title}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${theme.badgeBg} ${theme.badgeText}`}
        >
          {items.length}
        </span>
      </div>

      <div className={`max-h-[65vh] overflow-y-auto ${SCROLL_THIN}`}>
        {items.length === 0 ? (
          <p className="p-4 text-xs text-gray-400">{emptyLabel}</p>
        ) : (
          items.map((s) => <ShipmentCard key={s.shipmentId} shipment={s} warehouses={warehouses} packing={packing} />)
        )}
      </div>
    </div>
  )
}

export function AdminLogisticsBoard({
  shipments,
  warehouses,
  packing,
  fullSummary,
}: {
  shipments: PendingShipment[]
  warehouses: Warehouse[]
  packing: PackingMap
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

      <UrgencyBanner items={shipments.map((s) => ({ deadline: s.deadline, isLate: s.isLate }))} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <ShipmentColumn
          title="Sin asignar"
          items={groups.unassigned}
          warehouses={warehouses}
          emptyLabel="Todo lo pendiente ya tiene bodega asignada."
          theme={UNASSIGNED_THEME}
          packing={packing}
        />

        {groups.byWarehouse.map(({ warehouse, items }, i) => (
          <ShipmentColumn
            key={warehouse.id}
            title={warehouse.name}
            items={items}
            warehouses={warehouses}
            emptyLabel="Nada asignado a esta bodega por ahora."
            theme={WAREHOUSE_THEMES[i % WAREHOUSE_THEMES.length]}
            packing={packing}
          />
        ))}
      </div>
    </div>
  )
}
