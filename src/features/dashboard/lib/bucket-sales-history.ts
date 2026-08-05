import type { SalesHistoryPoint } from '../types'

export type HistoryGranularity = 'hour' | 'weekday' | 'week' | 'month'
export type HistoryMetric = 'grossSales' | 'netProfit'

export interface HistoryBucket {
  key: string
  label: string
  value: number
  orderCount: number
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function filterByRange(points: SalesHistoryPoint[], rangeDays: number, now = Date.now()): SalesHistoryPoint[] {
  const cutoff = now - rangeDays * 24 * 60 * 60 * 1000
  return points.filter((p) => new Date(p.dateCreated).getTime() >= cutoff)
}

export function bucketSalesHistory(
  points: SalesHistoryPoint[],
  granularity: HistoryGranularity,
  metric: HistoryMetric,
  now = Date.now()
): HistoryBucket[] {
  if (granularity === 'hour') {
    const buckets: HistoryBucket[] = Array.from({ length: 24 }, (_, h) => ({
      key: String(h),
      label: `${String(h).padStart(2, '0')}h`,
      value: 0,
      orderCount: 0,
    }))
    for (const p of points) {
      const h = new Date(p.dateCreated).getHours()
      buckets[h].value += p[metric]
      buckets[h].orderCount += 1
    }
    return buckets
  }

  if (granularity === 'weekday') {
    const buckets: HistoryBucket[] = WEEKDAY_LABELS.map((label, i) => ({
      key: String(i),
      label,
      value: 0,
      orderCount: 0,
    }))
    for (const p of points) {
      const jsDay = new Date(p.dateCreated).getDay() // 0=Sun..6=Sat
      const i = (jsDay + 6) % 7 // 0=Mon..6=Sun
      buckets[i].value += p[metric]
      buckets[i].orderCount += 1
    }
    return buckets
  }

  if (granularity === 'month') {
    const map = new Map<number, HistoryBucket>()
    for (const p of points) {
      const d = new Date(p.dateCreated)
      const key = d.getFullYear() * 12 + d.getMonth()
      if (!map.has(key)) {
        map.set(key, { key: String(key), label: MONTH_LABELS[d.getMonth()], value: 0, orderCount: 0 })
      }
      const bucket = map.get(key)!
      bucket.value += p[metric]
      bucket.orderCount += 1
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, bucket]) => bucket)
  }

  // week: rolling 7-day windows counting back from now, not calendar-ISO weeks
  const map = new Map<number, HistoryBucket>()
  for (const p of points) {
    const ageDays = Math.floor((now - new Date(p.dateCreated).getTime()) / (24 * 60 * 60 * 1000))
    const weekIndex = Math.floor(ageDays / 7)
    if (!map.has(weekIndex)) {
      map.set(weekIndex, {
        key: String(weekIndex),
        label: weekIndex === 0 ? 'Esta semana' : `Hace ${weekIndex + 1} sem.`,
        value: 0,
        orderCount: 0,
      })
    }
    const bucket = map.get(weekIndex)!
    bucket.value += p[metric]
    bucket.orderCount += 1
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0]) // largest weekIndex (oldest) first, left to right
    .map(([, bucket]) => bucket)
}
