export interface PeriodMetrics {
  periodLabel: string
  orderCount: number
  unitsSold: number
  grossSales: number
  mlCommission: number
  shippingCost: number
  productCost: number
  fulfillmentFee: number
  netProfit: number
  marginRate: number
}

export interface FinancialSummary extends PeriodMetrics {
  previousPeriod: PeriodMetrics
}

export interface AdsSummary {
  campaignName: string
  status: string
  clicks: number
  cost: number
  attributedSales: number
  roas: number
  breakEvenRoas: number
  isLosingMoney: boolean
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
