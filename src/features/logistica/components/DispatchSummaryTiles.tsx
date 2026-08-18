import { formatCOP } from '@/shared/utils/format'
import type { PendingShipment } from '../types'
import type { FulfillmentType } from '../services/parse-shipment'
import type { FullSummary } from '../services/get-full-summary'

const TILE_ORDER: FulfillmentType[] = ['flex', 'mercado_envios', 'full']

const TILE_TITLE: Record<FulfillmentType, string> = {
  flex: 'Flex',
  mercado_envios: 'Agencia | Hasta las 17:00 hs',
  full: 'Full',
  other: 'Otro',
}

/**
 * Full has nothing to dispatch — ML ships it — so instead of a "por enviar"
 * count it answers the only two questions that apply: what's left there and
 * what it has brought in. Sits alongside the dispatch tiles rather than
 * taking a full row of its own.
 */
function FullTile({ summary }: { summary: FullSummary }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Full</p>
      <p className="mb-2 text-sm font-bold text-gray-900">Lo despacha Mercado Libre</p>

      {summary.products.map((p) => (
        <p key={p.productId} className="text-sm text-gray-600">
          {p.shortName} <span className="font-semibold text-gray-900">{p.stock}</span>
        </p>
      ))}

      <p className="mt-1 border-t border-gray-100 pt-1 text-sm text-gray-600">
        Vendidas <span className="font-semibold text-happy-greenDark">{summary.totalSold}</span>
        <span className="ml-2 text-xs text-gray-400">{formatCOP(summary.revenue)}</span>
      </p>
    </div>
  )
}

/** Mirrors ML's own "POR ENVIAR" tiles on Central de vendedores → Ventas. */
export function DispatchSummaryTiles({
  shipments,
  fullSummary,
}: {
  shipments: PendingShipment[]
  fullSummary: FullSummary | null
}) {
  const present = TILE_ORDER.filter((type) => shipments.some((s) => s.fulfillmentType === type))
  const hasFull = Boolean(fullSummary && fullSummary.products.length > 0)
  if (present.length === 0 && !hasFull) return null

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

      {hasFull && <FullTile summary={fullSummary!} />}
    </div>
  )
}
