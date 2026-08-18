import 'server-only'
import { mlGet } from './ml-client'
import { isFlex, FALLBACK_SHIPPING_COST_PER_PACKAGE_COP } from '../constants'

export interface ShipmentCost {
  /** What ML charges us to ship this package (0 on Flex — we deliver it ourselves). */
  shippingCharge: number
  /** What ML pays US back on this package ("Bonificación por envío", Flex only). */
  shippingBonus: number
  /** 'self_service' (Flex), 'xd_drop_off' (agencia), etc. — drives the dispatch fee. */
  logisticType: string | null
}

interface MlShipmentCostResponse {
  logistic_type: string | null
  base_cost: number | null
  shipping_option: { cost: number; list_cost: number } | null
}

/**
 * Real per-package shipping, straight from ML. Verified 2026-08-18 against
 * five of the user's own ML invoices, which behave in two distinct ways:
 *
 *  - Agencia / Mercado Envíos (`xd_drop_off`): ML CHARGES the seller, and the
 *    charge equals `shipping_option.list_cost` (invoice showed -$8,100 for a
 *    shipment whose list_cost was 8,100). It genuinely differs per order
 *    (-$8,100 / -$8,500 / -$8,000), so a flat average misstates each one.
 *
 *  - Flex (`self_service`): ML charges NOTHING and instead PAYS a bonus
 *    ("Bonificación por envío": +$990, +$980 on real invoices), because the
 *    seller delivers it themselves. The bonus equals base_cost - list_cost.
 *    Treating Flex like agencia was subtracting ~$8,900 from orders that
 *    actually earned ~$990 — a ~$9,900 error per Flex order, and most of
 *    this account's orders are Flex.
 *
 * Never throws: a shipment ML won't return falls back to the average rather
 * than breaking the whole dashboard.
 */
export async function getShipmentCost(shipmentId: number | string): Promise<ShipmentCost> {
  try {
    const shipment = await mlGet<MlShipmentCostResponse>(`/shipments/${shipmentId}`)
    const listCost = shipment.shipping_option?.list_cost ?? FALLBACK_SHIPPING_COST_PER_PACKAGE_COP

    if (isFlex(shipment.logistic_type)) {
      const bonus = Math.max((shipment.base_cost ?? listCost) - listCost, 0)
      return { shippingCharge: 0, shippingBonus: bonus, logisticType: shipment.logistic_type }
    }

    return { shippingCharge: listCost, shippingBonus: 0, logisticType: shipment.logistic_type }
  } catch {
    return {
      shippingCharge: FALLBACK_SHIPPING_COST_PER_PACKAGE_COP,
      shippingBonus: 0,
      logisticType: null,
    }
  }
}
