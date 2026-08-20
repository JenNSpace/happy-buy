import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'

/**
 * ML's own dispatch clock for one shipment, from `/shipments/{id}/sla`.
 *
 * This is the same thing the seller sees on mercadolibre.com: `expected_date`
 * is the moment ML expects the package handed over, and `status` is literally
 * where "no afecta tu reputación" on their screen comes from. Verified against
 * 50 real shipments 2026-08-19 — it accounts for business days, Colombian
 * holidays and the same-day cutoff, none of which we can reproduce reliably.
 */
export interface ShipmentSla {
  /** ISO instant ML expects the hand-off by. */
  expectedDate: string | null
  /** 'on_time' | 'delayed' as returned by ML; anything else passes through untouched. */
  status: string | null
}

interface MlSlaResponse {
  status?: string | null
  expected_date?: string | null
}

/**
 * Never throws: a missing SLA must not take down the whole board. Callers get
 * nulls and fall back to computing the cutoff themselves (see
 * `getDispatchCutoff`), which is worse but still usable.
 */
export async function getShipmentSla(shipmentId: number): Promise<ShipmentSla> {
  try {
    const sla = await mlGet<MlSlaResponse>(`/shipments/${shipmentId}/sla`)
    return { expectedDate: sla.expected_date ?? null, status: sla.status ?? null }
  } catch {
    return { expectedDate: null, status: null }
  }
}
