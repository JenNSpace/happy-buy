export type UrgencyTier = 'overdue' | 'urgent' | 'warning' | 'ok' | 'unknown'

export interface CountdownInfo {
  tier: UrgencyTier
  label: string
}

const URGENT_MINUTES = 60
const WARNING_MINUTES = 240

/**
 * `deadline` is ML's real `estimated_delivery_limit.date` per shipment
 * (varies by flex/full, fetched live — never hardcoded) — confirmed with
 * the user 2026-08-06 as the right field to count down against.
 */
export function getCountdownInfo(deadline: string | null, now: Date = new Date()): CountdownInfo {
  if (!deadline) return { tier: 'unknown', label: 'Sin fecha límite' }

  const diffMinutes = Math.round((new Date(deadline).getTime() - now.getTime()) / 60_000)

  if (diffMinutes < 0) {
    const overdueMinutes = -diffMinutes
    const days = Math.floor(overdueMinutes / 1440)
    const hours = Math.floor((overdueMinutes % 1440) / 60)
    const minutes = overdueMinutes % 60

    // Packages overdue by days are likely stuck/lost — worth flagging, but
    // "Venció hace 6325h" isn't readable; switch to days once it's been a while.
    const label = days > 0 ? `${days}d ${hours}h` : `${hours > 0 ? `${hours}h ` : ''}${minutes}min`
    return { tier: 'overdue', label: `Venció hace ${label}` }
  }

  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  const timeLabel = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`

  if (diffMinutes < URGENT_MINUTES) return { tier: 'urgent', label: `Quedan ${timeLabel}` }
  if (diffMinutes < WARNING_MINUTES) return { tier: 'warning', label: `Quedan ${timeLabel}` }
  return { tier: 'ok', label: `Quedan ${timeLabel}` }
}

export const TIER_TEXT_STYLE: Record<UrgencyTier, string> = {
  overdue: 'font-semibold text-red-700',
  urgent: 'font-semibold text-red-600',
  warning: 'font-medium text-amber-600',
  ok: 'text-gray-500',
  unknown: 'text-gray-400',
}

export const TIER_ICON: Record<UrgencyTier, string> = {
  overdue: '🔴',
  urgent: '🔴',
  warning: '🟡',
  ok: '🟢',
  unknown: '',
}
