import { getProductMargin } from '../services/get-product-margin'
import { ProductMarginTable } from './ProductMarginTable'

export async function ProductMarginSection() {
  const items = await getProductMargin()
  return <ProductMarginTable items={items} />
}
