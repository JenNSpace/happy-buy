export const ML_USER_ID = '131725890' // HAPPYBUYCOL
export const ML_SITE_ID = 'MCO'

export const ITEM_PACK_SIZE: Record<string, number> = {
  MCO2821059102: 1, // Sellina Naturally Sal Céltica
  MCO2821136930: 1, // Sal Celtica Celtic Sea Salt 454g (main listing)
  MCO1822107893: 2, // Pack X2
  MCO3529015714: 4, // Pack X4 (shipping estimated, no real sample yet)
}

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
