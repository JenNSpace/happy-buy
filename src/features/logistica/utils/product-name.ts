import type { PackingInfo } from '@/features/inventario/services/get-product-catalog'

export type PackingMap = Record<string, PackingInfo>

/**
 * ML's real titles are long marketing copy ("Sal Celtica Celtic Sea Salt
 * 454 Gramos Selina Naturally") — fine for a buyer, confusing for someone
 * packing boxes fast. The user reported real mix-up incidents (wrong pack
 * size sent) and asked for short, plain names instead.
 *
 * The map itself lives in `products.short_name` (see
 * inventario/services/get-product-catalog.ts's getPackingMap), fetched once per
 * page load and threaded down as a prop — this function is just the
 * lookup-with-fallback.
 */
export function getShortProductName(packing: PackingMap, itemId: string, fallbackTitle: string): string {
  return packing[itemId]?.shortName ?? fallbackTitle
}

/** Spanish plural for the unit words we actually use: bolsa→bolsas, unidad→unidades. */
function pluralize(word: string, count: number): string {
  if (count === 1) return word
  return /[aeiou]$/i.test(word) ? `${word}s` : `${word}es`
}

export interface PackingLine {
  /** THE number to put in the box — quantity sold × units inside each sale. */
  totalUnits: number
  /** 'bolsa' / 'bolsas' / 'unidades', already agreeing with totalUnits. */
  unitLabel: string
  /** 'PACK X3' when the listing itself is a bundle, else null. */
  packLabel: string | null
  /** Where the number came from, shown only when it isn't a plain single unit. */
  breakdown: string | null
  /** True when we have no mapping for this listing and the count can't be trusted. */
  unknown: boolean
}

/**
 * How many physical units this order line means, and how to say it.
 *
 * Two multipliers stack and both are invisible on ML's screen in one direction
 * or the other: how many the buyer bought, and how many units one sale
 * contains. Verified against 60 days of real sales (2026-08-19): 42% of orders
 * need more than one unit packed, and one real order was 2 × Pack X2 = 4 bags
 * while ML displayed "2 unidades".
 *
 * An unmapped listing returns `unknown` and the raw ML quantity. It is not
 * assumed to be 1: that assumption under-packs a paid order, which is the
 * expensive way to be wrong.
 */
export function getPackingLine(packing: PackingMap, itemId: string, quantity: number): PackingLine {
  const info = packing[itemId]

  if (!info) {
    return {
      totalUnits: quantity,
      unitLabel: pluralize('unidad', quantity),
      packLabel: null,
      breakdown: null,
      unknown: true,
    }
  }

  const totalUnits = quantity * info.unitsPerSale
  const unitLabel = pluralize(info.baseUnit, totalUnits)
  const packLabel = info.unitsPerSale > 1 ? `PACK X${info.unitsPerSale}` : null

  let breakdown: string | null = null
  if (quantity > 1 && info.unitsPerSale > 1) {
    breakdown = `${quantity} ventas × ${info.unitsPerSale} ${pluralize(info.baseUnit, info.unitsPerSale)} = ${totalUnits}`
  } else if (info.unitsPerSale > 1) {
    breakdown = `1 venta de ${info.unitsPerSale} ${pluralize(info.baseUnit, info.unitsPerSale)}`
  } else if (quantity > 1) {
    breakdown = `${quantity} ${pluralize(info.baseUnit, quantity)} sueltas`
  }

  return { totalUnits, unitLabel, packLabel, breakdown, unknown: false }
}
