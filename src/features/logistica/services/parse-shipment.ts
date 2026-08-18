/**
 * Shared parsing for fields the admin and bodega views need out of a raw
 * `GET /shipments/{id}` response.
 */
export interface MlShipmentCore {
  status: string
  substatus: string | null
  logistic_type: string | null
  date_first_printed: string | null
  status_history: { date_shipped: string | null }
}

export type FulfillmentType = 'flex' | 'full' | 'mercado_envios' | 'other'

// Verified live against real shipments 2026-08-06: `self_service` = Flex,
// `xd_drop_off` = standard Mercado Envíos (the current account barely uses
// `fulfillment`/Full — confirmed by the user, only found on one stale order).
export function getFulfillmentType(shipment: MlShipmentCore): FulfillmentType {
  if (shipment.logistic_type === 'self_service') return 'flex'
  if (shipment.logistic_type === 'fulfillment') return 'full'
  if (shipment.logistic_type === 'xd_drop_off' || shipment.logistic_type === 'drop_off' || shipment.logistic_type === 'cross_docking') {
    return 'mercado_envios'
  }
  return 'other'
}

export function isLabelPrinted(shipment: MlShipmentCore): boolean {
  return Boolean(shipment.date_first_printed)
}

// Real ML shipment.status values still needing OUR action (not yet handed
// to the carrier). Everything else — shipped/delivered/not_delivered/
// cancelled — means our job on it is done or moot.
const NEEDS_DISPATCH_STATUSES = new Set(['pending', 'handling', 'ready_to_ship'])

/**
 * `status` alone is NOT enough — this is the bug the 2026-08-18 audit missed
 * and the user caught: a Cable Ugreen already dropped at the agency (ML's own
 * screen showed "En camino · Llega entre hoy y mañana") still reported
 * `status: ready_to_ship`, identical to a package still sitting in the
 * warehouse. `status` only flips to `shipped` once the carrier scans it,
 * which can be a day or more later. `substatus` is the field that actually
 * separates them: `printed` = still ours, `dropped_off` = already handed over.
 */
const SUBSTATUS_STILL_OURS = new Set([
  'ready_to_print',
  'printed',
  'invoice_pending',
  'measures_ready',
  'stale',
])

const SUBSTATUS_ALREADY_GONE = new Set([
  'dropped_off', // left at a Mercado Libre agency — confirmed live 2026-08-18
  'picked_up',
  'in_hub',
  'in_warehouse',
  'on_route',
  'out_for_delivery',
  'soon_deliver',
  'waiting_for_withdrawal',
])

export type DispatchState =
  | 'pending' // still physically with us — must be dispatched
  | 'gone' // already handed to the carrier or agency
  | 'unknown' // substatus ML returned that we don't recognise

/**
 * Unrecognised substatuses deliberately resolve to `unknown`, not `gone`.
 * The two failure modes are not symmetric in cost but both are real: hiding a
 * package that still needs dispatch means it never gets sent, showing one
 * already sent risks delivering it twice. So anything we can't classify stays
 * VISIBLE and is flagged for a human to check against ML, rather than being
 * silently dropped either way.
 */
export function getDispatchState(shipment: MlShipmentCore): DispatchState {
  if (!NEEDS_DISPATCH_STATUSES.has(shipment.status)) return 'gone'

  const sub = shipment.substatus
  if (!sub) return 'pending'
  if (SUBSTATUS_STILL_OURS.has(sub)) return 'pending'
  if (SUBSTATUS_ALREADY_GONE.has(sub)) return 'gone'
  return 'unknown'
}

/** True while the package is (or might still be) ours to dispatch. */
export function needsDispatch(shipment: MlShipmentCore): boolean {
  return getDispatchState(shipment) !== 'gone'
}
