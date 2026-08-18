export const ML_USER_ID = '131725890' // HAPPYBUYCOL
export const ML_SITE_ID = 'MCO'

/**
 * Business assumptions used to compute real (post-cost) margin.
 * Sourced from real data reviewed with the user on 2026-08-05 — update here
 * when iHerb pricing, ML's commission, or the fulfillment fee changes.
 */
export const ML_SALE_COMMISSION_RATE = 0.115 // confirmed flat 11.5% on Sal Céltica category (MCO413201)

/**
 * Fallback landed cost per unit, used ONLY when a sold listing has no
 * purchases recorded for its product yet. Real per-product costs come from
 * the purchases table — see inventario/services/get-product-costs.ts.
 * (Average of 3 real Sal Céltica receipts: 34,221.95 / 35,077.73 / 32,945.92.)
 */
export const FALLBACK_PRODUCT_COST_PER_UNIT_COP = 34082

/**
 * Fallback seller-side ML shipping cost per PACKAGE, used only when the real
 * per-shipment cost can't be read from ML. Verified live 2026-08-18 that ML
 * charges a different amount per order (8,100 / 8,820 / 8,910 on four real
 * orders the same week), so this average is a last resort, never the norm.
 */
export const FALLBACK_SHIPPING_COST_PER_PACKAGE_COP = 8600

// Paid to the bodega per package handled. Mirrors warehouses.fee_per_package_flex/_agencia.
export const BODEGA_FEE_FLEX_COP = 3000
export const FULFILLMENT_FEE_AGENCIA_COP = 5000

/**
 * Flat fee charged by the external courier that actually delivers Flex orders
 * (Bogotá only) — confirmed by the user 2026-08-18 via Enrique. It is charged
 * ON TOP of the bodega's own Flex fee, so a Flex package really costs
 * 3,000 + 7,500 = 10,500, not the 3,000 assumed before.
 */
export const FLEX_COURIER_FEE_COP = 7500

/**
 * Retención en la fuente withheld on payouts. Not exposed by any ML API
 * (verified 2026-08-18: the order API reports taxes_amount 0 and the billing
 * ledger only carries CV/CXD/PADS charges) — these are Mercado Pago
 * withholdings, so this rate is an estimate. It matched two real invoices to
 * the peso ($1,950 on $129,996 and $975 on $64,998) but not a third
 * ($706 on $49,714 = 1.42%), so always label it as estimated in the UI.
 */
export const TAX_WITHHOLDING_RATE = 0.015

// ROAS needed just to break even on ad spend, given the margin above product+shipping+ML costs.
export function breakEvenRoas(marginRate: number) {
  return 1 / marginRate
}

export function isFlex(logisticType: string | null | undefined): boolean {
  return logisticType === 'self_service' || logisticType === 'flex'
}

/** Paid to Gina/Daniel for handling the package — cheaper on Flex (no trip to the agency). */
export function bodegaFeeFor(logisticType: string | null | undefined): number {
  return isFlex(logisticType) ? BODEGA_FEE_FLEX_COP : FULFILLMENT_FEE_AGENCIA_COP
}

/** Paid to the external Bogotá courier — Flex only; on agencia ML does the delivery. */
export function flexCourierFeeFor(logisticType: string | null | undefined): number {
  return isFlex(logisticType) ? FLEX_COURIER_FEE_COP : 0
}

/**
 * Per-LINE economics of an order: only the costs that genuinely scale with
 * what was sold. Shipping and the dispatch fee are deliberately NOT here —
 * they're charged once per package, and folding them into the line meant an
 * order with 2 units (or 2 different products) was billed 2x shipping and
 * 2x the dispatch fee. Found live 2026-08-18 on a real 2-unit Multitoma
 * order charged $16,920 of shipping when ML actually charged $8,910 once.
 * Callers add the per-package costs themselves (see getFinancialSummary).
 *
 * `saleFee` is ML's OWN per-unit commission for that listing (`sale_fee` on
 * the order item). Pass it whenever available: the commission is not a flat
 * 11.5% — verified against real invoices 2026-08-18 it is 11.5% on Sal
 * Céltica, 16% on Multitoma and 18.5% on Cable Ugreen, so any hardcoded rate
 * silently misstates every non-salt sale. ML_SALE_COMMISSION_RATE is only a
 * last-resort fallback.
 *
 * `unitsPerSale` comes from `product_listings` (a "Pack X2" listing sells 2
 * physical units per order line); `productCostPerUnit` is the real landed
 * cost for that product (see get-product-costs.ts).
 */
export function computeOrderLineMetrics(
  quantity: number,
  unitPrice: number,
  unitsPerSale: number,
  productCostPerUnit: number = FALLBACK_PRODUCT_COST_PER_UNIT_COP,
  saleFee?: number
) {
  const grossSales = unitPrice * quantity
  const mlCommission = saleFee !== undefined ? saleFee * quantity : grossSales * ML_SALE_COMMISSION_RATE
  const productCost = productCostPerUnit * unitsPerSale * quantity

  return { grossSales, mlCommission, productCost }
}
