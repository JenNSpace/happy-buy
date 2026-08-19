import type { MlPayment, MoneyReleaseStatus } from '@/types/database'

/** Un cargo dentro de `charges_details`. Solo nos importan los que paga el vendedor. */
export interface MpCharge {
  name: string
  type: string
  accounts?: { from?: string; to?: string }
  amounts?: { original?: number; refunded?: number }
  rate?: number
  base_amount?: number
}

/** Forma de un pago tal como llega de `/v1/payments/search`. */
export interface MpPayment {
  id: number
  order?: { id?: string | number } | null
  /** Ventas nuestras lo traen plano; las compras de Jen lo traen anidado en `collector`. */
  collector_id?: number | string | null
  collector?: { id?: number | string | null } | null
  operation_type: string
  description?: string | null
  status: string
  date_approved?: string | null
  money_release_date?: string | null
  money_release_status?: string | null
  transaction_amount: number
  transaction_details?: { net_received_amount?: number } | null
  charges_details?: MpCharge[] | null
}

/** La bonificación de envío Flex llega como pago suelto, sin `order.id`. */
export const FLEX_BONUS_DESCRIPTION = 'bonificaciones_flex_fc'

/**
 * Cargos clasificados por prefijo, no por nombre exacto: el catálogo real de un
 * año de operación (1.441 pagos, revisado 2026-08-18) trae más variantes de las
 * que se ven en una muestra chica —
 * `shp_cross_docking` · `shp_fulfillment` · `shp_dropoff` ·
 * `tax_withholding-fuente` · `-ica_bogota` · `-ica_antioquia_medellin` ·
 * `-iva` · `-inscription_iva`.
 * Clasificar por prefijo hace que un ICA de otra ciudad entre solo el día que
 * aparezca, sin tocar código.
 */
const MELI_FEE = 'meli_fee'
const SHIPPING_PREFIX = 'shp_'
const TAX_PREFIX = 'tax_withholding'

const KNOWN_CHARGES = new Set([
  'meli_fee',
  'shp_cross_docking',
  'shp_fulfillment',
  'shp_dropoff',
  'tax_withholding-fuente',
  'tax_withholding-ica_bogota',
  'tax_withholding-ica_antioquia_medellin',
  'tax_withholding-iva',
  'tax_withholding-inscription_iva',
])

const unknownChargesSeen = new Set<string>()

function chargeAmount(charge: MpCharge): number {
  return (charge.amounts?.original ?? 0) - (charge.amounts?.refunded ?? 0)
}

export interface ChargeBreakdown {
  meliFee: number
  shippingCharge: number
  taxWithholding: number
  /** Cargos reales que no supimos clasificar. Suman al total igual. */
  other: number
}

/**
 * Reparte los cargos del vendedor en las categorías que la UI muestra.
 *
 * Solo cuentan los que tienen `accounts.from === 'collector'`: esos son los que
 * salen del bolsillo del vendedor.
 *
 * ⚠️ ESTO NO RECONSTRUYE EL NETO, y esa suposición ya costó una corrección.
 * Sobre 4 pagos de muestra `bruto − Σcargos = net_received_amount` cuadraba al
 * centavo, así que se dio por ley. Sobre los 1.441 reales falla en ~21%:
 * ML **lista** cargos que no descuenta de ese pago (los cobra en la factura
 * mensual), y no hay regla por nombre — `shp_fulfillment` se descuenta en unos
 * pagos y en otros no.
 *
 * Por eso `net_received_amount` de la API es la autoridad para el total, y este
 * desglose es informativo: sirve para mostrar en qué se fue la plata, no para
 * calcular cuánta quedó.
 */
export function breakdownCharges(charges: MpCharge[] | null | undefined): ChargeBreakdown {
  const result: ChargeBreakdown = { meliFee: 0, shippingCharge: 0, taxWithholding: 0, other: 0 }

  for (const charge of charges ?? []) {
    if (charge.accounts?.from !== 'collector') continue

    const amount = chargeAmount(charge)
    const name = charge.name ?? ''

    if (name === MELI_FEE) {
      result.meliFee += amount
    } else if (name.startsWith(SHIPPING_PREFIX)) {
      result.shippingCharge += amount
    } else if (name.startsWith(TAX_PREFIX)) {
      // Son DOS: retención en la fuente (1,5%) e ICA Bogotá (0,414%).
      result.taxWithholding += amount
    } else {
      result.other += amount
      if (!KNOWN_CHARGES.has(name) && !unknownChargesSeen.has(name)) {
        unknownChargesSeen.add(name)
        console.warn(
          `[finanzas] Cargo de Mercado Pago sin clasificar: "${name}". Se está sumando al total, ` +
            `pero conviene mapearlo en breakdownCharges() para que aparezca en su propia fila.`
        )
      }
    }
  }

  return result
}

/**
 * Pago crudo → fila de `ml_payments`.
 *
 * `net_received_amount` de la API manda siempre: es lo que ML dice que depositó,
 * y ningún cálculo propio le gana. La reconstrucción restando cargos es solo un
 * último recurso para pagos que no lo traigan, y se sabe que puede quedar corta
 * (ver `breakdownCharges`) — por eso no se usa cuando el dato real existe.
 */
export function parsePayment(payment: MpPayment): MlPayment {
  const b = breakdownCharges(payment.charges_details)
  const totalCharges = b.meliFee + b.shippingCharge + b.taxWithholding + b.other

  const net = payment.transaction_details?.net_received_amount ?? payment.transaction_amount - totalCharges

  const releaseStatus = payment.money_release_status
  const isKnownStatus = releaseStatus === 'pending' || releaseStatus === 'released'

  const collector = payment.collector_id ?? payment.collector?.id ?? null

  return {
    id: payment.id,
    order_id: payment.order?.id != null ? String(payment.order.id) : null,
    collector_id: collector != null ? Number(collector) : null,
    operation_type: payment.operation_type,
    description: payment.description ?? null,
    status: payment.status,
    date_approved: payment.date_approved ?? null,
    money_release_date: payment.money_release_date ?? null,
    money_release_status: isKnownStatus ? (releaseStatus as MoneyReleaseStatus) : null,
    transaction_amount: payment.transaction_amount,
    net_received_amount: net,
    meli_fee: b.meliFee,
    shipping_charge: b.shippingCharge,
    tax_withholding: b.taxWithholding,
    charges: payment.charges_details ?? null,
    synced_at: new Date().toISOString(),
  }
}

/**
 * ID de Happy Buy como vendedora. Un pago cuyo `collector_id` no coincide es
 * una COMPRA que hizo Jen, no una venta: `/v1/payments/search` devuelve las dos
 * cosas sin distinguirlas.
 *
 * Descubierto 2026-08-18 de la peor forma: cinco compras suyas (crema dental,
 * arena para gatos, empaques) por $587.071 se mostraron como ventas propias
 * "retenidas por ML". El neto igual al bruto era la pista —a una venta real
 * siempre le cobran comisión— y los cargos iban dirigidos al `payer`.
 */
export const HAPPY_BUY_COLLECTOR_ID = 131725890

/** Un pago es una venta real (no una bonificación ni un movimiento suelto). */
export function isSalePayment(payment: Pick<MlPayment, 'operation_type' | 'order_id'>): boolean {
  return payment.operation_type === 'regular_payment' && payment.order_id !== null
}

/** Un pago es la bonificación que ML paga por entregar en Flex. */
export function isFlexBonus(payment: Pick<MlPayment, 'description'>): boolean {
  return payment.description === FLEX_BONUS_DESCRIPTION
}
