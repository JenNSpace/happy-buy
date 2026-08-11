/**
 * Shared parsing for fields the admin and bodega views need out of a raw
 * `GET /shipments/{id}` response.
 */
export interface MlShipmentCore {
  status: string
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
// cancelled — means our job on it is done or moot, and it must NOT show as
// pending: found live 2026-08-06 that a shipment with status "shipped"
// (already handed off the day before) was still showing in the pending
// queue, because the earlier `/sla`-based check only detects
// cancelled/long-resolved shipments, not "already dispatched" ones — a
// real risk of re-sending or double-handling something already shipped.
const NEEDS_DISPATCH_STATUSES = new Set(['pending', 'handling', 'ready_to_ship'])

export function needsDispatch(shipment: MlShipmentCore): boolean {
  return NEEDS_DISPATCH_STATUSES.has(shipment.status)
}
