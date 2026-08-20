'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markDelivered } from '../services/mark-delivered'
import { getCountdownInfo, TIER_TEXT_STYLE, TIER_ICON } from '../utils/countdown'
import { getDispatchMessage } from '../utils/dispatch-cutoff'
import { FulfillmentBadge, FULFILLMENT_BORDER_STYLE, FULFILLMENT_CARD_BG } from './FulfillmentBadge'
import { ProductLine } from './ProductLine'
import type { PackingMap } from '../utils/product-name'
import type { BodegaShipment } from '../types'

/**
 * La urgencia toma superficie SOLO cuando hay algo que avisar — igual que en el
 * tablero de admin, para que las dos vistas se lean como un mismo sistema. El
 * color del canal se queda con el borde izquierdo y el fondo suave de la
 * tarjeta (FULFILLMENT_CARD_BG), que es lo que la usuaria pidió el 2026-08-06
 * para distinguir Flex de agencia de un vistazo.
 */
const URGENCY_BOX_STYLE = {
  overdue: 'rounded-md border border-red-200 bg-red-50 p-2',
  urgent: 'rounded-md border border-red-200 bg-red-50 p-2',
  warning: 'rounded-md border border-amber-200 bg-amber-50 p-2',
  ok: '',
  unknown: '',
} as const

export function BodegaShipmentCard({
  shipment,
  packing,
}: {
  shipment: BodegaShipment
  packing: PackingMap
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
  const dispatchMessage = getDispatchMessage(shipment.fulfillmentType, shipment.deadline, isOverdue)

  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-4 p-4 ${FULFILLMENT_CARD_BG[shipment.fulfillmentType]} ${FULFILLMENT_BORDER_STYLE[shipment.fulfillmentType]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <FulfillmentBadge type={shipment.fulfillmentType} />
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
                packing={packing}
              />
            ))}
          </div>
          <p className="mt-1 text-sm text-gray-500">{shipment.address}</p>

          <div className={`mt-2 ${URGENCY_BOX_STYLE[countdown.tier]}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <span className="whitespace-nowrap text-xs text-gray-400">
                Vendido el{' '}
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
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/api/shipping/label/${shipment.shipmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {shipment.printed ? 'Reimprimir guía' : 'Imprimir guía'}
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
