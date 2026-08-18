import 'server-only'
import { getCatalogStatus } from './get-catalog-status'
import {
  ML_SALE_COMMISSION_RATE,
  FALLBACK_PRODUCT_COST_PER_UNIT_COP,
  FALLBACK_SHIPPING_COST_PER_PACKAGE_COP,
  FULFILLMENT_FEE_AGENCIA_COP,
} from '../constants'
import { getListingMap } from '@/features/inventario/services/get-product-catalog'
import { getProductCostPerUnit } from '@/features/inventario/services/get-product-costs'
import type { ProductMargin } from '../types'

/**
 * Expected margin per listing at its current price. Product cost is the real
 * per-product figure from purchases; shipping and dispatch are the average
 * per-package estimates, since this is a forward-looking "what would I make
 * if this sells" number with no actual shipment to read a real cost from.
 */
export async function getProductMargin(): Promise<ProductMargin[]> {
  const [items, listingMap, productCosts] = await Promise.all([
    getCatalogStatus(),
    getListingMap(),
    getProductCostPerUnit(),
  ])

  return items
    .map((item) => {
      const listing = listingMap.get(item.id)
      const unitsPerSale = listing?.unitsPerSale ?? 1
      const costPerUnit = listing
        ? productCosts.get(listing.productId) ?? FALLBACK_PRODUCT_COST_PER_UNIT_COP
        : FALLBACK_PRODUCT_COST_PER_UNIT_COP

      const commission = item.price * ML_SALE_COMMISSION_RATE
      const productCost = costPerUnit * unitsPerSale
      const marginAmount =
        item.price -
        commission -
        productCost -
        FALLBACK_SHIPPING_COST_PER_PACKAGE_COP -
        FULFILLMENT_FEE_AGENCIA_COP
      const marginRate = item.price > 0 ? marginAmount / item.price : 0

      return {
        id: item.id,
        title: item.title,
        price: item.price,
        marginAmount,
        marginRate,
      }
    })
    .sort((a, b) => b.marginRate - a.marginRate)
}
