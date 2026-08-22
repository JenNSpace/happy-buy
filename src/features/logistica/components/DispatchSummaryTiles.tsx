import { formatCOP } from '@/shared/utils/format'
import { pluralize } from '@/shared/utils/pluralize'
import { SURFACE_CARD, PILL, EYEBROW, HAIRLINE_T } from '@/shared/ui/surface'
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

/** El dato que la tarjeta promete en su título va grande; lo demás lo acompaña. */
function Hero({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[30px] font-bold leading-none tabular-nums tracking-tight text-gray-900">{value}</span>
      <span className="text-[13px] leading-tight text-gray-500">{label}</span>
    </div>
  )
}

/**
 * Full has nothing to dispatch — ML ships it — so instead of a "por enviar"
 * count it answers the only two questions that apply: what's left there and
 * what it has brought in. Sits alongside the dispatch tiles rather than
 * taking a full row of its own.
 */
function FullTile({ summary }: { summary: FullSummary }) {
  return (
    <div className={`${SURFACE_CARD} flex h-full flex-col p-4`}>
      <span className={`${PILL} w-fit bg-gray-900 text-white`}>Full</span>
      <p className="mt-2 text-[15px] font-semibold leading-tight text-gray-900">Lo despacha Mercado Libre</p>

      <div className="mt-3 space-y-1 pb-2.5">
        {summary.products.map((p) => (
          <div key={p.productId} className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate text-gray-500">{p.shortName}</span>
            <span className="shrink-0 font-semibold tabular-nums text-gray-900">{p.stock}</span>
          </div>
        ))}
      </div>

      <div className={`mt-auto flex items-baseline justify-between gap-2 pt-2.5 text-[13px] ${HAIRLINE_T}`}>
        <span className="text-gray-500">Vendidas</span>
        <span className="shrink-0">
          {/* greenText, no greenDark: a 13px el greenDark no pasa AA sobre blanco. */}
          <span className="font-semibold tabular-nums text-happy-greenText">{summary.totalSold}</span>
          <span className="ml-2 text-[11px] tabular-nums text-gray-400">{formatCOP(summary.revenue)}</span>
        </span>
      </div>
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
          <div key={type} className={`${SURFACE_CARD} flex h-full flex-col p-4`}>
            <p className={EYEBROW}>Por enviar</p>
            <p className="mt-0.5 text-[15px] font-semibold leading-tight text-gray-900">{TILE_TITLE[type]}</p>

            <div className="mt-auto pt-3">
              <Hero value={readyToShip} label={`${pluralize('lista', readyToShip)} para despachar`} />

              {/* Solo cuando hay algo por imprimir: un "0 etiquetas" constante le
                  enseña al ojo a saltarse este renglón. */}
              {toPrint > 0 && (
                <p className={`mt-2.5 pt-2.5 text-[13px] text-gray-500 ${HAIRLINE_T}`}>
                  <span className="font-semibold tabular-nums text-gray-900">{toPrint}</span>{' '}
                  {pluralize('etiqueta', toPrint)} por imprimir
                </p>
              )}
            </div>
          </div>
        )
      })}

      {hasFull && <FullTile summary={fullSummary!} />}
    </div>
  )
}
