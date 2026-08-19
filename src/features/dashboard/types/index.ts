export interface PeriodMetrics {
  periodLabel: string
  orderCount: number
  unitsSold: number
  grossSales: number
  mlCommission: number
  /** What ML charged us to ship (agencia orders; Flex is 0 because we deliver it ourselves). */
  shippingCost: number
  /** "Bonificación por envío" ML pays back on Flex orders — money IN, not a cost. */
  shippingBonus: number
  productCost: number
  /** Paid to the bodegas (Gina/Daniel) for handling packages. */
  bodegaFee: number
  /** Paid to the external Bogotá courier that delivers Flex orders. */
  flexCourierFee: number
  /** How many packages went out each way — the two channels cost very different amounts. */
  flexOrderCount: number
  agenciaOrderCount: number
  /**
   * REAL withholdings ML applied (retención en la fuente + ICA + IVA, whichever
   * apply), read per payment. Only estimated for orders whose payment hasn't
   * synced yet — see `provisionalOrderCount`.
   */
  taxWithholding: number
  /**
   * Charges ML lists on a payment but doesn't deduct from it (it bills them
   * monthly instead). Almost always 0; exists so the breakdown adds up to the
   * real net instead of looking like a maths error.
   */
  otherMlCharges: number
  /** Orders still without their ML payment synced — computed the old way, not exact. */
  provisionalOrderCount: number
  netProfit: number
  marginRate: number
}

export interface FinancialSummary extends PeriodMetrics {
  previousPeriod: PeriodMetrics
}

export interface AdsSummary {
  campaignName: string
  status: string
  budget: number
  roasTarget: number
  clicks: number
  cost: number
  attributedSales: number
  roas: number
  breakEvenRoas: number
  isLosingMoney: boolean
}

export interface ProductAdsPerformance {
  itemId: string
  title: string
  clicks: number
  cost: number
  attributedSales: number
  roas: number
}

export interface CatalogItem {
  id: string
  title: string
  price: number
  soldQuantity: number
  availableQuantity: number
  status: string
}

export interface ProductMargin {
  id: string
  title: string
  price: number
  marginAmount: number
  marginRate: number
}

export type RecommendationSeverity = 'urgent' | 'warning' | 'good'

export interface Recommendation {
  severity: RecommendationSeverity
  message: string
}

export interface SalesHistoryPoint {
  dateCreated: string // ISO timestamp, order's date_created
  grossSales: number
  netProfit: number
  unitsSold: number
}
