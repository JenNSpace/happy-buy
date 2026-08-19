import type { FulfillmentType } from '../services/parse-shipment'

/**
 * Deadline for OUR job — getting the package into the carrier's hands. What
 * happens afterwards is the carrier's problem (confirmed by the user
 * 2026-08-06).
 *
 * **Flex is 13:00, and that is NOT what ML's screen says.** ML shows 21:00,
 * which is when the *buyer* must have received it; the courier that actually
 * collects the package passes at 13:00 at the latest (confirmed by Ricky via
 * the user, 2026-08-18). By 21:00 the package left eight hours ago, so showing
 * ML's number gave the bodega a deadline that was useless: the label has to be
 * printed and stuck on before the courier arrives, not before the buyer gets it.
 *
 * Agencia keeps 17:00 — verified live 2026-08-06 against 5 real orders in the
 * user's own ML dashboard, and nobody has contradicted it.
 *
 * `full` has no cutoff (ML ships it), so it stays undefined.
 */
const CUTOFF_HOUR_BY_TYPE: Partial<Record<FulfillmentType, number>> = {
  mercado_envios: 17,
  flex: 13,
}

/**
 * Types where an order arriving after the cutoff belongs to the NEXT day's
 * round, not to a deadline that already passed.
 *
 * Only Flex: once the courier has come and gone at 13:00, a 14:00 order simply
 * waits for tomorrow — it is not late (confirmed by the user 2026-08-18 via
 * Ricky). Marking it overdue would show a red alarm for something nobody can
 * act on, which is how real alarms get ignored. Agencia is different: the
 * agency stays open until 17:00 and the package can still be dropped off.
 */
const ROLLS_OVER_TO_NEXT_DAY: Partial<Record<FulfillmentType, boolean>> = {
  flex: true,
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

/** Midnight on the 1st of the current month, Bogotá local time. */
export function getBogotaMonthStart(now: Date = new Date()): string {
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01T00:00:00${BOGOTA_UTC_OFFSET}`
}

/**
 * The bodegas are paid per FORTNIGHT, not per month — confirmed by the user
 * 2026-08-18 (Enrique "paga por quincena"; Daniel was already paid through
 * 15-ago). Periods are the 1st-15th and the 16th-end of month, Bogotá local.
 * Scoping earnings to the current fortnight makes the figure reset itself when
 * the period rolls over, so there is nothing to "mark as paid" for the normal
 * case — the exception is a fortnight that closed while still unpaid, which
 * needs a real payment record rather than a date window.
 */
export function getBogotaFortnightStart(now: Date = new Date()): string {
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  const day = bogotaNow.getDate() <= 15 ? '01' : '16'
  return `${y}-${m}-${day}T00:00:00${BOGOTA_UTC_OFFSET}`
}

/** Human label for the current fortnight, e.g. "16–31 de agosto". */
export function getFortnightLabel(now: Date = new Date()): string {
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const monthName = bogotaNow.toLocaleDateString('es-CO', { month: 'long', timeZone: 'America/Bogota' })
  if (bogotaNow.getDate() <= 15) return `1–15 de ${monthName}`
  const lastDay = new Date(bogotaNow.getFullYear(), bogotaNow.getMonth() + 1, 0).getDate()
  return `16–${lastDay} de ${monthName}`
}

/**
 * Next cutoff instant for this type, or null if none applies (e.g. Full).
 *
 * For Flex, once 13:00 has passed the answer is TOMORROW at 13:00: the courier
 * already came, so the package goes in the next round. For agencia the deadline
 * stays today — the agency is still open and it can be dropped off.
 */
export function getDispatchCutoff(fulfillmentType: FulfillmentType, now: Date = new Date()): string | null {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined) return null

  // Compute "today" in Bogotá local time regardless of the server's own timezone.
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))

  if (ROLLS_OVER_TO_NEXT_DAY[fulfillmentType] && bogotaNow.getHours() >= hour) {
    bogotaNow.setDate(bogotaNow.getDate() + 1)
  }

  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  const d = String(bogotaNow.getDate()).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')

  return `${y}-${m}-${d}T${hh}:00:00${BOGOTA_UTC_OFFSET}`
}

/** Un envío Flex que entró pasada la hora del courier: sale mañana, no va tarde. */
export function rollsOverToTomorrow(fulfillmentType: FulfillmentType, now: Date = new Date()): boolean {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined || !ROLLS_OVER_TO_NEXT_DAY[fulfillmentType]) return false

  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return bogotaNow.getHours() >= hour
}

/**
 * Mensaje de despacho, escrito para quien empaca — no copiado de ML.
 *
 * Para agencia se conserva la redacción de ML (capturada de la pantalla real
 * 2026-08-06) porque ahí el plazo coincide. Para Flex NO: ML dice "tu comprador
 * debe recibir el paquete antes de las 21 hs", que es cierto pero inútil para la
 * bodega — lo que importa es que la etiqueta esté impresa y pegada antes de que
 * el transportista pase, a la 1 pm.
 */
export function getDispatchMessage(
  fulfillmentType: FulfillmentType,
  isOverdue: boolean,
  now: Date = new Date()
): string | null {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined) return null

  if (fulfillmentType === 'flex') {
    if (rollsOverToTomorrow(fulfillmentType, now)) {
      // No es un retraso: el courier ya pasó y este sale en la ronda de mañana.
      return 'El transportista ya pasó hoy. Este sale mañana — deja la etiqueta impresa y pegada antes de la 1 pm.'
    }
    return 'El transportista pasa hoy a la 1 pm como máximo. La etiqueta tiene que estar impresa y pegada antes de que llegue.'
  }

  if (isOverdue) {
    return `Se pasó la hora de corte (${hour} hs) — esto puede afectar tu reputación. Despáchalo ya.`
  }

  return `Tienes que despachar el paquete hoy antes de las ${hour} hs en una agencia de Mercado Libre para no demorarte.`
}
