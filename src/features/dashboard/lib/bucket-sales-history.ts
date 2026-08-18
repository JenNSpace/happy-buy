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

  // week: calendar weeks, Monday-Sunday — not a rolling 7-day window (confirmed by the user 2026-08-15).
  const mondayOf = (d: Date): Date => {
    const day = d.getDay() // 0=Sun..6=Sat
    const diffToMonday = day === 0 ? 6 : day - 1
    const monday = new Date(d)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(d.getDate() - diffToMonday)
    return monday
  }
  const thisWeekMonday = mondayOf(new Date(now)).getTime()

  const map = new Map<number, HistoryBucket>()
  for (const p of points) {
    const monday = mondayOf(new Date(p.dateCreated))
    const key = monday.getTime()
    if (!map.has(key)) {
      let label: string
      if (key === thisWeekMonday) {
        label = 'Esta semana'
      } else {
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        label =
          monday.getMonth() === sunday.getMonth()
            ? `${monday.getDate()}-${sunday.getDate()} ${MONTH_LABELS[sunday.getMonth()]}`
            : `${monday.getDate()} ${MONTH_LABELS[monday.getMonth()]} - ${sunday.getDate()} ${MONTH_LABELS[sunday.getMonth()]}`
      }
      map.set(key, { key: String(key), label, value: 0, orderCount: 0 })
    }
    const bucket = map.get(key)!
    bucket.value += p[metric]
    bucket.orderCount += 1
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0]) // oldest week first, left to right
    .map(([, bucket]) => bucket)
}
