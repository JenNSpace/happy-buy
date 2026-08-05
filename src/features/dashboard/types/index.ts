export interface FinancialSummary {
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
