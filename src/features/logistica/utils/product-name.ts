/**
 * ML's real titles are long marketing copy ("Sal Celtica Celtic Sea Salt
 * 454 Gramos Selina Naturally") — fine for a buyer, confusing for someone
 * packing boxes fast. The user reported real mix-up incidents (wrong pack
 * size sent) and asked for short, plain names instead. Same item ids as
 * `src/features/dashboard/constants.ts`'s `ITEM_PACK_SIZE`.
 */
const SHORT_NAME: Record<string, string> = {
  MCO2821059102: 'Sal Céltica 454g',
  MCO2821136930: 'Sal Céltica 454g',
  MCO1822107893: 'Sal Céltica 454g x2',
  MCO3529015714: 'Sal Céltica 454g x4',
}

export function getShortProductName(itemId: string, fallbackTitle: string): string {
  return SHORT_NAME[itemId] ?? fallbackTitle
}
