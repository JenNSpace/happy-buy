import type { PendingShipment } from '../types'
import type { FulfillmentType } from '../services/parse-shipment'

const TILE_ORDER: FulfillmentType[] = ['flex', 'mercado_envios', 'full']

const TILE_TITLE: Record<FulfillmentType, string> = {
  flex: 'Flex',
  mercado_envios: 'Agencia | Hasta las 17:00 hs',
  full: 'Full',
  other: 'Otro',
}

/** Mirrors ML's own "POR ENVIAR" tiles on Central de vendedores → Ventas. */
export function DispatchSummaryTiles({ shipments }: { shipments: PendingShipment[] }) {
  const present = TILE_ORDER.filter((type) => shipments.some((s) => s.fulfillmentType === type))
  if (present.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {present.map((type) => {
        const items = shipments.filter((s) => s.fulfillmentType === type)
        const toPrint = items.filter((s) => !s.printed).length
        const readyToShip = items.filter((s) => s.printed).length

        return (
          <div key={type} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Por enviar</p>
            <p className="mb-2 text-sm font-bold text-gray-900">{TILE_TITLE[type]}</p>
            {toPrint > 0 && (
              <p className="text-sm text-gray-600">
                Etiquetas por imprimir <span className="font-semibold text-happy-greenDark">{toPrint}</span>
              </p>
            )}
            <p className="text-sm text-gray-600">
              Listas para despachar <span className="font-semibold text-happy-greenDark">{readyToShip}</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}
