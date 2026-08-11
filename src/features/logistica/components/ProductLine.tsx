import { getShortProductName } from '../utils/product-name'

/**
 * The quantity gets a big, unmissable badge on its own — the user reported
 * real packing mix-ups (wrong unit count sent) and wants the number to be
 * impossible to skim past, not just a small "2×" prefix in a sentence.
 */
export function ProductLine({ itemId, title, quantity }: { itemId: string; title: string; quantity: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-happy-green text-lg font-extrabold text-white">
        {quantity}
      </span>
      <span className="text-base font-semibold text-gray-900">{getShortProductName(itemId, title)}</span>
    </div>
  )
}
