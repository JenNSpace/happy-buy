import type { FulfillmentType } from '../services/parse-shipment'

/**
 * Deadline for OUR job — getting the package into the carrier's hands. What
 * happens afterwards is the carrier's problem (confirmed by the user
 * 2026-08-06).
 *
 * **Flex is 13:00, and that is NOT what ML's screen says.** ML shows 21:00-23:00,
 * which is when the *buyer* must have received it; the courier that actually
 * collects the package passes at 13:00 at the latest (confirmed by Ricky via
 * the user, 2026-08-18). By 21:00 the package left eight hours ago, so showing
 * ML's number gave the bodega a deadline that was useless: the label has to be
 * printed and stuck on before the courier arrives, not before the buyer gets it.
 *
 * Agencia keeps 17:00 — verified live 2026-08-06 against 5 real orders in the
 * user's own ML dashboard, and again 2026-08-19 against `/shipments/{id}/sla`,
 * which returns exactly 17:00 for every agencia shipment.
 *
 * `full` has no cutoff (ML ships it), so it stays undefined.
 */
const CUTOFF_HOUR_BY_TYPE: Partial<Record<FulfillmentType, number>> = {
  mercado_envios: 17,
  flex: 13,
}

/**
 * Fallback only — which types roll to the next day when ML's own SLA is
 * unavailable. See `getDispatchCutoff`: normally the DAY comes from ML.
 */
const ROLLS_OVER_TO_NEXT_DAY: Partial<Record<FulfillmentType, boolean>> = {
  flex: true,
  mercado_envios: true,
}

const BOGOTA_UTC_OFFSET = '-05:00'

/** Same instant, expressed with Bogotá's wall-clock fields (Bogotá has no DST). */
function toBogota(instant: Date): Date {
  return new Date(instant.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
}

function dayKey(bogotaDate: Date): string {
  const y = bogotaDate.getFullYear()
  const m = String(bogotaDate.getMonth() + 1).padStart(2, '0')
  const d = String(bogotaDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Midnight today, Bogotá local time, as an ISO instant — for "today" bounds elsewhere (e.g. delivered-today history). */
export function getBogotaTodayStart(now: Date = new Date()): string {
  return `${dayKey(toBogota(now))}T00:00:00${BOGOTA_UTC_OFFSET}`
}

/** Midnight on the 1st of the current month, Bogotá local time. */
export function getBogotaMonthStart(now: Date = new Date()): string {
  const bogotaNow = toBogota(now)
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
  const bogotaNow = toBogota(now)
  const y = bogotaNow.getFullYear()
  const m = String(bogotaNow.getMonth() + 1).padStart(2, '0')
  const day = bogotaNow.getDate() <= 15 ? '01' : '16'
  return `${y}-${m}-${day}T00:00:00${BOGOTA_UTC_OFFSET}`
}

/** Human label for the current fortnight, e.g. "16–31 de agosto". */
export function getFortnightLabel(now: Date = new Date()): string {
  const bogotaNow = toBogota(now)
  const monthName = bogotaNow.toLocaleDateString('es-CO', { month: 'long', timeZone: 'America/Bogota' })
  if (bogotaNow.getDate() <= 15) return `1–15 de ${monthName}`
  const lastDay = new Date(bogotaNow.getFullYear(), bogotaNow.getMonth() + 1, 0).getDate()
  return `16–${lastDay} de ${monthName}`
}

/**
 * When this package has to be handed over. Null if no cutoff applies (Full).
 *
 * **The DAY comes from Mercado Libre, the HOUR is ours.** We used to compute
 * both, and it was wrong: an agencia order that came in at 21:36 was shown as
 * "Venció hace 5h" when ML's own screen said "despáchalo mañana, no afecta tu
 * reputación" (caught by the user 2026-08-19). Reproducing ML's rule ourselves
 * is not realistic — checked against 50 real shipments, it involves business
 * days, Colombian holidays (everything from 15-16 ago skipped Monday 17, a
 * holiday), a same-day cutoff, and it counts from payment rather than from the
 * sale. So we read `expected_date` from `/shipments/{id}/sla` and only override
 * the hour, because ML's hour is the delivery promise (23:00 for Flex), not the
 * moment the courier actually collects.
 *
 * `slaExpectedDate` null (ML didn't answer) falls back to arithmetic: today,
 * or tomorrow if the cutoff already passed. That errs toward "it's for
 * tomorrow" rather than raising a red alarm nobody can act on.
 */
export function getDispatchCutoff(
  fulfillmentType: FulfillmentType,
  slaExpectedDate: string | null = null,
  now: Date = new Date()
): string | null {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined) return null

  let day: string
  if (slaExpectedDate) {
    day = dayKey(toBogota(new Date(slaExpectedDate)))
  } else {
    const fallback = new Date(now)
    if (ROLLS_OVER_TO_NEXT_DAY[fulfillmentType] && toBogota(now).getHours() >= hour) {
      fallback.setUTCDate(fallback.getUTCDate() + 1)
    }
    day = dayKey(toBogota(fallback))
  }

  return `${day}T${String(hour).padStart(2, '0')}:00:00${BOGOTA_UTC_OFFSET}`
}

/** True when the deadline falls on a later Bogotá day than today — i.e. nobody can act on it today. */
export function isForALaterDay(deadline: string | null, now: Date = new Date()): boolean {
  if (!deadline) return false
  return dayKey(toBogota(new Date(deadline))) > dayKey(toBogota(now))
}

/**
 * "mañana", or the weekday when it is further out — a Friday-night agencia
 * order is due Monday, and calling that "mañana" would be a lie the bodega
 * plans around. ML skips weekends and Colombian holidays, so this really does
 * happen (verified 2026-08-19: orders from the 15th and 16th landed on the
 * 18th, because Monday the 17th was a holiday).
 */
function laterDayLabel(deadline: string, now: Date = new Date()): string {
  const deadlineDay = toBogota(new Date(deadline))
  const today = toBogota(now)
  const diffDays = Math.round(
    (new Date(dayKey(deadlineDay)).getTime() - new Date(dayKey(today)).getTime()) / 86_400_000
  )
  if (diffDays <= 1) return 'mañana'
  return `el ${deadlineDay.toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'America/Bogota' })}`
}

/**
 * Mensaje de despacho, escrito para quien empaca — no copiado de ML.
 *
 * Para agencia se conserva la redacción de ML (capturada de su pantalla real,
 * 2026-08-06 y 2026-08-19) porque ahí el plazo coincide. Para Flex NO: ML dice
 * que el comprador debe recibirlo antes de las 23 hs, cierto pero inútil para la
 * bodega — lo que importa es que la etiqueta esté impresa y pegada antes de que
 * el transportista pase, a la 1 pm.
 */
export function getDispatchMessage(
  fulfillmentType: FulfillmentType,
  deadline: string | null,
  /** Nuestro corte ya pasó — distinto de "ML lo da por atrasado", ver `getCountdownInfo`. */
  pastCutoff: boolean,
  now: Date = new Date()
): string | null {
  const hour = CUTOFF_HOUR_BY_TYPE[fulfillmentType]
  if (hour === undefined) return null

  const forLaterDay = isForALaterDay(deadline, now)

  if (fulfillmentType === 'flex') {
    // No es un retraso: el courier ya pasó (o es festivo) y este sale en la próxima ronda.
    if (forLaterDay && deadline) {
      return `El transportista no pasa más hoy. Este sale ${laterDayLabel(deadline, now)} — deja la etiqueta impresa y pegada antes de la 1 pm.`
    }
    // Ya pasó la 1 pm de HOY: la ronda siguiente no la sabemos sin preguntarle a ML
    // (un viernes por la noche es el lunes), así que no se nombra un día que no
    // podemos verificar. Decir "pasa hoy" a las 10 pm era simplemente falso.
    if (pastCutoff) {
      return 'El transportista ya no pasa más hoy. Este sale en la próxima ronda — deja la etiqueta impresa y pegada antes de la 1 pm.'
    }
    return 'El transportista pasa hoy a la 1 pm como máximo. La etiqueta tiene que estar impresa y pegada antes de que llegue.'
  }

  if (forLaterDay && deadline) {
    return `Tienes que despachar el paquete ${laterDayLabel(deadline, now)} en una agencia de Mercado Libre.`
  }

  // "Despáchalo ya" no sirve a las 10 pm con la agencia cerrada.
  if (pastCutoff) {
    return `Se pasó la hora de corte (${hour} hs) — llévalo apenas puedas a una agencia.`
  }

  return `Tienes que despachar el paquete hoy antes de las ${hour} hs en una agencia de Mercado Libre para no demorarte.`
}
