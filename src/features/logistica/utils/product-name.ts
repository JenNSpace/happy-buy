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
  /** "Empacar 3 bolsas" — the instruction, only when it isn't a single unit. */
  instruction: string | null
  /**
   * What ML's own screen says, ONLY when it disagrees with our total. That
   * happens exactly when the listing is a bundle: ML sells "1 unidad" of a
   * Pack X3. Saying it out loud is what lets someone reconcile the card against
   * Mercado Libre instead of assuming one of the two is broken.
   */
  mlNote: string | null
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
      instruction: null,
      mlNote: null,
      unknown: true,
    }
  }

  const totalUnits = quantity * info.unitsPerSale
  const unitLabel = pluralize(info.baseUnit, totalUnits)

  return {
    totalUnits,
    unitLabel,
    packLabel: info.unitsPerSale > 1 ? `PACK X${info.unitsPerSale}` : null,
    instruction: totalUnits > 1 ? `Empacar ${totalUnits} ${unitLabel}` : null,
    // Solo cuando ML muestra otro número: si la publicación no es un pack, ML y
    // nosotros decimos lo mismo y repetirlo sería ruido.
    mlNote: info.unitsPerSale > 1 ? `En Mercado Libre aparece como ${quantity} unidad${quantity > 1 ? 'es' : ''}` : null,
    unknown: false,
  }
}
