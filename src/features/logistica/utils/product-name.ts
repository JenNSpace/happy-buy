/**
 * ML's real titles are long marketing copy ("Sal Celtica Celtic Sea Salt
 * 454 Gramos Selina Naturally") — fine for a buyer, confusing for someone
 * packing boxes fast. The user reported real mix-up incidents (wrong pack
 * size sent) and asked for short, plain names instead.
 *
 * The map itself now lives in `products.short_name` (see
 * inventario/services/get-product-catalog.ts's getShortNameMap), fetched
 * once per page load and threaded down as a prop — this function is just
 * the lookup-with-fallback.
 */
export function getShortProductName(shortNames: Record<string, string>, itemId: string, fallbackTitle: string): string {
  return shortNames[itemId] ?? fallbackTitle
}
