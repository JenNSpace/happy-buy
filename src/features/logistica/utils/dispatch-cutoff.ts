import type { FulfillmentType } from '../services/parse-shipment'

/**
 * Not a per-shipment API value — verified live 2026-08-06 against 5 real
 * orders in the user's own ML seller dashboard (order creation times
 * ranging from 01:06 to 22:37 the day before, ALL showing the same cutoff
 * for their type): Mercado Envíos/agencia drop-off closes at 17:00,
 * Flex at 21:00, both Bogotá local time, regardless of when the order was
 * placed. A per-shipment field (`/shipments/{id}/sla`) was tried first and
 * looked plausible but gave 23:00 for a Flex order the UI showed as 21:00 —
 * discarded once it didn't match the real screen. `full` has no cutoff
 * shown in the user's UI at all (and she confirmed the account barely uses
 * Full), so it's left undefined.
 *
 * This is the deadline for OUR job — handing the package to the agency or
 * to the Flex courier. What happens after that is the carrier's problem,
 * not counted here (confirmed explicitly by the user 2026-08-06).
 */
const CUTOFF_HOUR_BY_TYPE: Partial<Record<FulfillmentType, number>> = {
  mercado_envios: 17,
  flex: 21,
}

const BOGOTA_UTC_OFFSET = '-05:00'

/** Midnight today, Bogotá local time, as an ISO instant — for "today" bounds elsewhere (e.g. delivered-today history). */
export function getBogotaTodayStart(now: Date = new Date()): string {
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  const d = String(bogotaNow.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00${BOGOTA_UTC_OFFSET}`
}

/** Midnight on the 1st of the current month, Bogotá local time — for "this month" bounds (e.g. warehouse fee payouts). */
export function getBogotaMonthStart(now: Date = new Date()): string {
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01T00:00:00${BOGOTA_UTC_OFFSET}`
}

/** Today's cutoff instant for this fulfillment type, or null if none applies (e.g. Full). */
export function getDispatchCutoff(fulfillmentType: FulfillmentType, now: Date = new Date()): string | null {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined) return null

  // Compute "today" in Bogotá local time regardless of the server's own timezone.
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  const d = String(bogotaNow.getDate()).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')

  return `${y}-${m}-${d}T${hh}:00:00${BOGOTA_UTC_OFFSET}`
}

/**
 * Mirrors the wording ML shows on its own order cards, so the message
 * reads the same whether you're on ML's dashboard or ours. Real strings
 * from the user's screenshots (2026-08-06):
 *  - Agencia: "Tienes que despachar el paquete hoy antes de las 17 hs en
 *    una agencia de Mercado Libre para no demorarte."
 *  - Flex: "Tu comprador debe recibir el paquete hoy antes de las 21 hs.
 *    Envíalo a tiempo para no afectar tu reputación."
 * The overdue variant is ours (not seen in a screenshot) — ML's own
 * wording for that state wasn't captured, so this is a clear, honest
 * equivalent rather than a guess at their exact copy.
 */
export function getDispatchMessage(fulfillmentType: FulfillmentType, isOverdue: boolean): string | null {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined) return null

  if (isOverdue) {
    return `Se pasó la hora de corte (${hour} hs) — esto puede afectar tu reputación. Despáchalo ya.`
  }

  if (fulfillmentType === 'mercado_envios') {
    return `Tienes que despachar el paquete hoy antes de las ${hour} hs en una agencia de Mercado Libre para no demorarte.`
  }

  return `Tu comprador debe recibir el paquete hoy antes de las ${hour} hs. Envíalo a tiempo para no afectar tu reputación.`
}
