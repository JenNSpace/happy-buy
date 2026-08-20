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

/**
 * Si Mercado Libre da este envío por atrasado. Es la ÚNICA alarma real.
 *
 * Nuestro corte es más estricto a propósito (Flex 1 pm contra las 23:00 de ML)
 * para que la bodega alcance al transportista; pasarse de él significa "sale en
 * la próxima ronda", no "hay una emergencia". Confundir las dos cosas ponía un
 * rojo de alarma sobre una tarjeta cuyo propio texto decía que nadie podía
 * hacer nada hoy (lo señaló la usuaria el 2026-08-20).
 *
 * Si ML no devolvió estado, se cae a comparar el día: un plazo que quedó en un
 * día anterior al de hoy sí es un paquete estancado.
 */
export function isLateForMl(sla: ShipmentSla, now: Date = new Date()): boolean {
  if (sla.status) return sla.status !== 'on_time'
  if (!sla.expectedDate) return false

  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  return day(new Date(sla.expectedDate)) < day(now)
}
