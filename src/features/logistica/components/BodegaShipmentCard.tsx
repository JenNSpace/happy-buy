'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markDelivered } from '../services/mark-delivered'
import { getCountdownInfo, TIER_TEXT_STYLE, TIER_ICON } from '../utils/countdown'
import { getDispatchMessage } from '../utils/dispatch-cutoff'
import { FulfillmentBadge, FULFILLMENT_BORDER_STYLE } from './FulfillmentBadge'
import { ProductLine } from './ProductLine'
import type { BodegaShipment } from '../types'

const CARD_BORDER_STYLE = {
  overdue: 'border-red-400 bg-red-50',
  urgent: 'border-red-300 bg-red-50',
  warning: 'border-amber-300 bg-amber-50',
  ok: 'border-gray-200 bg-white',
  unknown: 'border-gray-200 bg-white',
} as const

export function BodegaShipmentCard({
  shipment,
  shortNames,
}: {
  shipment: BodegaShipment
  shortNames: Record<string, string>
}) {
  const router = useRouter()
  const [delivering, setDelivering] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [countdown, setCountdown] = useState(() => getCountdownInfo(shipment.deadline))

  useEffect(() => {
    const interval = setInterval(() => setCountdown(getCountdownInfo(shipment.deadline)), 60_000)
    return () => clearInterval(interval)
  }, [shipment.deadline])

  async function handleDeliver() {
    setDelivering(true)
    const result = await markDelivered(
      shipment.shipmentId,
      shipment.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      shipment.fulfillmentType
    )
    setDelivering(false)
    if (!result?.error) {
      setDelivered(true)
      router.refresh()
    }
  }

  if (delivered) return null

  const isOverdue = countdown.tier === 'overdue'
  const dispatchMessage = getDispatchMessage(shipment.fulfillmentType, isOverdue)

  return (
    <div
      className={`rounded-lg border border-l-4 p-4 ${CARD_BORDER_STYLE[countdown.tier]} ${FULFILLMENT_BORDER_STYLE[shipment.fulfillmentType]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <FulfillmentBadge type={shipment.fulfillmentType} />
            {shipment.printed && <span className="text-[10px] font-medium text-gray-400">🖨 Guía impresa</span>}
          </div>
          {/* Never hide a shipment we couldn't classify — make the human check it. */}
          {shipment.dispatchState === 'unknown' && (
            <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
              Estado no reconocido — confirma en Mercado Libre antes de despacharlo.
            </p>
          )}
          <div className="space-y-1.5">
            {shipment.items.map((item, i) => (
              <ProductLine
                key={i}
                itemId={item.itemId}
                title={item.description}
                quantity={item.quantity}
                shortNames={shortNames}
              />
            ))}
          </div>
          <p className="mt-1 text-sm text-gray-500">{shipment.address}</p>
          <p className={`mt-1 text-xs ${TIER_TEXT_STYLE[countdown.tier]}`}>
            {TIER_ICON[countdown.tier]} {countdown.label}
          </p>
          {dispatchMessage && (
            <p className={`mt-1 text-xs ${isOverdue ? 'font-medium text-red-600' : 'text-gray-500'}`}>
              {dispatchMessage}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/api/shipping/label/${shipment.shipmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Imprimir guía
        </a>
        <button
          onClick={handleDeliver}
          disabled={delivering}
          className="rounded-md bg-happy-green px-3 py-1.5 text-sm text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {delivering ? 'Guardando...' : 'Marcar entregado'}
        </button>
      </div>
    </div>
  )
}
