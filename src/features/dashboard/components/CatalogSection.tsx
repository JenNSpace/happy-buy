import { getCatalogStatus } from '../services/get-catalog-status'
import { CatalogStatusCard } from './CatalogStatusCard'

export async function CatalogSection() {
  const items = await getCatalogStatus()
  return <CatalogStatusCard items={items} />
}
