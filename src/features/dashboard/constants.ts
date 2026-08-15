export const ML_USER_ID = '131725890' // HAPPYBUYCOL
export const ML_SITE_ID = 'MCO'

/**
 * Business assumptions used to compute real (post-cost) margin.
 * Sourced from real data reviewed with the user on 2026-08-05 — update here
 * when iHerb pricing, ML's commission, or the fulfillment fee changes.
 */
export const ML_SALE_COMMISSION_RATE = 0.115 // confirmed flat 11.5% on Sal Céltica category (MCO413201)

// Landed cost per unit of Sal Céltica (iHerb price, free shipping at 9-12 units/order).
// Average of 3 real receipts: 34,221.95 / 35,077.73 / 32,945.92
export const PRODUCT_COST_PER_UNIT_COP = 34082

// Seller-side ML shipping cost, sampled from real orders (varies day to day).
export const SHIPPING_COST_SINGLE_UNIT_COP = 8460 // avg of 8730/8100/8910/8100
export const SHIPPING_COST_PACK_X2_COP = 8500 // real Pack X2 shipment, ~4,250/unit

// Paid to the user's mother in Bogotá per package dispatched (not per unit).
export const FULFILLMENT_FEE_FLEX_COP = 3000
export const FULFILLMENT_FEE_FULL_COP = 5000

// ROAS needed just to break even on ad spend, given the margin above product+shipping+ML costs.
export function breakEvenRoas(marginRate: number) {
  return 1 / marginRate
}

export function shippingCostForItem(unitsPerSale: number): number {
  if (unitsPerSale <= 1) return SHIPPING_COST_SINGLE_UNIT_COP
  // Bundles ship far more efficiently than N singles — use the real Pack X2 rate per unit as the estimate for all bundles.
  return (SHIPPING_COST_PACK_X2_COP / 2) * unitsPerSale
}

/**
 * Real (post-cost) economics of a single order line item — shared by every
 * service that aggregates orders (period summary, sales history) so the cost
 * model lives in exactly one place. `unitsPerSale` comes from
 * `product_listings` (see inventario/services/get-product-catalog.ts),
 * resolved once per request by the caller — pass 1 for an unmapped/unknown
 * listing.
 *
 * Bug fixed 2026-08-14: productCost and shippingCost were NOT being
 * multiplied by pack size here (unlike get-product-margin.ts's parallel,
 * correct calculation) — every historical Pack X2/X3/X4 sale had its real
 * per-unit cost undercounted, overstating netProfit on the dashboard and
 * sales-history chart. Confirmed real, not theoretical: Pack X2 alone has
 * 55 real sales.
 */
export function computeOrderLineMetrics(quantity: number, unitPrice: number, unitsPerSale: number) {
  const grossSales = unitPrice * quantity
  const mlCommission = grossSales * ML_SALE_COMMISSION_RATE
  const shippingCost = shippingCostForItem(unitsPerSale) * quantity
  const productCost = PRODUCT_COST_PER_UNIT_COP * unitsPerSale * quantity
  const fulfillmentFee = FULFILLMENT_FEE_FULL_COP
  const netProfit = grossSales - mlCommission - shippingCost - productCost - fulfillmentFee

  return { grossSales, mlCommission, shippingCost, productCost, fulfillmentFee, netProfit }
}
