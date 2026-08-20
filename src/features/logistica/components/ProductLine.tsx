import { getPackingLine, getShortProductName, type PackingMap } from '../utils/product-name'

/**
 * One line of "what goes in the box".
 *
 * The big number is the count of PHYSICAL units, not the quantity ML shows.
 * Those differ whenever the listing is a bundle: a "Pack X3" sale reads as
 * "1 unidad" on ML's screen but means three bags, and the short-name lookup
 * was erasing the "Pack X3" from the title on top of that — so the card was
 * telling the bodega to pack one. Measured over 60 days (2026-08-19): 42% of
 * orders need more than one unit packed, 10 of 50 were bundle listings, and one
 * was 2 × Pack X2 = 4 bags.
 *
 * Emphasis is by SIZE, never by alarm color: red/amber/green belong to urgency
 * on these cards (see FulfillmentBadge's note) and blue/orange to the channel,
 * so a multi-unit line grows instead of turning amber. The pack chip is neutral
 * dark for the same reason — it needs a channel of its own.
 */
export function ProductLine({
  itemId,
  title,
  quantity,
  packing,
}: {
  itemId: string
  title: string
  quantity: number
  packing: PackingMap
}) {
  const line = getPackingLine(packing, itemId, quantity)
  const isMulti = line.totalUnits > 1

  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-happy-green font-extrabold text-white ${
          isMulti ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg'
        }`}
      >
        {line.totalUnits}
      </span>

      <div className="min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-semibold text-gray-900">
            {getShortProductName(packing, itemId, title)}
          </span>
          {line.packLabel && (
            <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {line.packLabel}
            </span>
          )}
        </div>

        <p className={`text-sm ${isMulti ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{line.unitLabel}</p>

        {line.breakdown && <p className="text-[11px] text-gray-500">{line.breakdown}</p>}

        {/* Sin mapeo no podemos saber si la publicación es un pack: se avisa en vez
            de asumir 1, que es el error que manda el pedido incompleto. */}
        {line.unknown && (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
            Publicación nueva sin registrar — confirma en Mercado Libre cuántas unidades trae.
          </p>
        )}
      </div>
    </div>
  )
}
