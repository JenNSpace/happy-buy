import 'server-only'
import { getCatalogStatus } from './get-catalog-status'
import { ML_SALE_COMMISSION_RATE, PRODUCT_COST_PER_UNIT_COP, FULFILLMENT_FEE_FULL_COP, shippingCostForItem } from '../constants'
import { getListingMap } from '@/features/inventario/services/get-product-catalog'
import type { ProductMargin } from '../types'

export async function getProductMargin(): Promise<ProductMargin[]> {
  const [items, listingMap] = await Promise.all([getCatalogStatus(), getListingMap()])

  return items
    .map((item) => {
      const unitsPerSale = listingMap.get(item.id)?.unitsPerSale ?? 1
      const commission = item.price * ML_SALE_COMMISSION_RATE
      const productCost = PRODUCT_COST_PER_UNIT_COP * unitsPerSale
      const shipping = shippingCostForItem(unitsPerSale)
      const marginAmount = item.price - commission - productCost - shipping - FULFILLMENT_FEE_FULL_COP
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
