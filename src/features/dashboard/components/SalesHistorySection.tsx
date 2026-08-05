import { getSalesHistory } from '../services/get-sales-history'
import { SalesHistoryCard } from './SalesHistoryCard'

export async function SalesHistorySection() {
  const points = await getSalesHistory(90)
  return <SalesHistoryCard points={points} />
}
