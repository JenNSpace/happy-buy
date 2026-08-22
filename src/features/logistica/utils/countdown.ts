export type UrgencyTier = 'overdue' | 'urgent' | 'warning' | 'next_round' | 'ok' | 'unknown'

export interface CountdownInfo {
  tier: UrgencyTier
  label: string
}

const URGENT_MINUTES = 60
const WARNING_MINUTES = 240

/**
 * Cómo se presenta el plazo de un envío.
 *
 * `deadline` es el próximo momento en que el paquete se puede entregar (ver
 * `getDispatchCutoff`: día de Mercado Libre, hora nuestra).
 *
 * **Pasarse de NUESTRO corte no es una alarma.** Cuando el transportista de
 * Flex ya pasó, el paquete sale en la ronda siguiente y no hay nada que nadie
 * pueda hacer hoy: pintarlo de rojo pide una acción que no existe, y así es
 * como las alarmas de verdad terminan ignorándose. La usuaria lo señaló el
 * 2026-08-20 viendo una tarjeta que decía "ya no pasa más hoy" en rojo — el
 * texto y el color se contradecían.
 *
 * La alarma real la marca Mercado Libre (`isLate`), no nuestro corte interno,
 * que es deliberadamente más estricto: exige alcanzar al courier de la 1 pm
 * cuando ML mide contra las 23:00.
 */
export function getCountdownInfo(
  deadline: string | null,
  now: Date = new Date(),
  options: { isLate?: boolean } = {}
): CountdownInfo {
  if (!deadline) return { tier: 'unknown', label: 'Sin fecha límite' }

  const diffMinutes = Math.round((new Date(deadline).getTime() - now.getTime()) / 60_000)

  if (options.isLate) {
    if (diffMinutes >= 0) return { tier: 'overdue', label: 'Atrasado según Mercado Libre' }
    return { tier: 'overdue', label: `Atrasado hace ${elapsedLabel(-diffMinutes)}` }
  }

  // Nuestro corte ya pasó pero ML no lo da por atrasado: sale en la próxima ronda.
  if (diffMinutes < 0) return { tier: 'next_round', label: 'Sale en la próxima ronda' }

  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  const timeLabel = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`

  if (diffMinutes < URGENT_MINUTES) return { tier: 'urgent', label: `Quedan ${timeLabel}` }
  if (diffMinutes < WARNING_MINUTES) return { tier: 'warning', label: `Quedan ${timeLabel}` }
  return { tier: 'ok', label: `Quedan ${timeLabel}` }
}

/**
 * Packages late by days are likely stuck — worth flagging, but "6325h" isn't
 * readable; switch to days once it's been a while.
 */
function elapsedLabel(minutes: number): string {
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  return `${hours > 0 ? `${hours}h ` : ''}${mins}min`
}

export const TIER_TEXT_STYLE: Record<UrgencyTier, string> = {
  overdue: 'font-semibold text-red-700',
  urgent: 'font-semibold text-red-600',
  warning: 'font-medium text-amber-600',
  next_round: 'text-gray-500',
  ok: 'text-gray-500',
  unknown: 'text-gray-400',
}

export const TIER_ICON: Record<UrgencyTier, string> = {
  overdue: '🔴',
  urgent: '🔴',
  warning: '🟡',
  next_round: '🕐',
  ok: '🟢',
  unknown: '',
}

/**
 * La urgencia solo toma superficie de color cuando hay algo que hacer AHORA.
 * `next_round` queda sin caja a propósito: es información, no alarma.
 */
export const URGENCY_BOX_STYLE: Record<UrgencyTier, string> = {
  overdue: 'rounded-lg border border-red-200 bg-red-50 p-2.5',
  urgent: 'rounded-lg border border-red-200 bg-red-50 p-2.5',
  warning: 'rounded-lg border border-amber-200 bg-amber-50 p-2.5',
  next_round: '',
  ok: '',
  unknown: '',
}
