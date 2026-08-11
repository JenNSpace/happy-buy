import type { FulfillmentType } from '../services/parse-shipment'

const LABEL: Record<FulfillmentType, string> = {
  flex: 'Flex',
  full: 'Full',
  mercado_envios: 'Mercado Envíos',
  other: '',
}

// Blue vs orange — deliberately far apart on the color wheel per the user's
// request 2026-08-06 (a first attempt with blue/violet wasn't distinguishable
// enough). Never red/amber-warning/green, those are reserved for urgency
// (Countdown/UrgencyBanner) — two different things, two different channels.
const BADGE_STYLE: Record<FulfillmentType, string> = {
  flex: 'bg-blue-100 text-blue-700',
  mercado_envios: 'bg-orange-100 text-orange-700',
  full: 'bg-teal-100 text-teal-700',
  other: '',
}

export const FULFILLMENT_BORDER_STYLE: Record<FulfillmentType, string> = {
  flex: 'border-l-blue-500',
  mercado_envios: 'border-l-orange-500',
  full: 'border-l-teal-500',
  other: 'border-l-transparent',
}

// Same hue as the border, much lighter — so the whole card reads as
// "blue" or "orange" at a glance, not just a thin 4px edge you have to
// look for (confirmed with the user 2026-08-06: the border alone wasn't distinguishable enough).
export const FULFILLMENT_CARD_BG: Record<FulfillmentType, string> = {
  flex: 'bg-blue-50/60',
  mercado_envios: 'bg-orange-50/60',
  full: 'bg-teal-50/60',
  other: '',
}

export function FulfillmentBadge({ type }: { type: FulfillmentType }) {
  if (type === 'other') return null

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BADGE_STYLE[type]}`}>
      {LABEL[type]}
    </span>
  )
}
