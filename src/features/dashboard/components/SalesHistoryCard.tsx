'use client'

import { useMemo, useState } from 'react'
import { formatCOP } from '@/shared/utils/format'
import {
  bucketSalesHistory,
  filterByRange,
  type HistoryGranularity,
  type HistoryMetric,
} from '../lib/bucket-sales-history'
import { MiniBarChart } from './MiniBarChart'
import type { SalesHistoryPoint } from '../types'

const RANGE_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
]

const GRANULARITY_OPTIONS: { value: HistoryGranularity; label: string }[] = [
  { value: 'hour', label: 'Hora del día' },
  { value: 'weekday', label: 'Día de la semana' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]

const METRIC_OPTIONS: { value: HistoryMetric; label: string }[] = [
  { value: 'grossSales', label: 'Ventas' },
  { value: 'netProfit', label: 'Ganancia neta' },
]

function formatCompactCOP(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${Math.round(value)}`
}

export function SalesHistoryCard({ points }: { points: SalesHistoryPoint[] }) {
  const [rangeDays, setRangeDays] = useState(30)
  const [granularity, setGranularity] = useState<HistoryGranularity>('week')
  const [metric, setMetric] = useState<HistoryMetric>('grossSales')

  const buckets = useMemo(() => {
    const filtered = filterByRange(points, rangeDays)
    return bucketSalesHistory(filtered, granularity, metric)
  }, [points, rangeDays, granularity, metric])

  const peak = buckets.reduce((best, b) => (b.value > best.value ? b : best), buckets[0])
  const hasPeak = buckets.some((b) => b.value > 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Historial de ventas</h2>
        {hasPeak && (
          <span className="text-sm text-gray-500">
            Pico: {peak.label} · {formatCOP(peak.value)}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRangeDays(opt.value)}
              className={`rounded-md px-2 py-1 ${
                rangeDays === opt.value ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGranularity(opt.value)}
              className={`rounded-md px-2 py-1 ${
                granularity === opt.value ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMetric(opt.value)}
              className={`rounded-md px-2 py-1 ${
                metric === opt.value ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <MiniBarChart
        buckets={buckets.map((b) => ({
          key: b.key,
          label: b.label,
          value: b.value,
          tooltipDetail: `${b.orderCount} pedidos`,
        }))}
        color="#21B674"
        formatValue={formatCOP}
        formatAxis={formatCompactCOP}
        emptyLabel="No hay ventas en este período."
        showEveryNthLabel={granularity === 'hour' ? 3 : 1}
      />

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-happy-green hover:underline">Ver tabla</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="py-1 font-medium">Período</th>
              <th className="py-1 font-medium">Monto</th>
              <th className="py-1 font-medium">Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key} className="border-b border-gray-50">
                <td className="py-1 text-gray-700">{b.label}</td>
                <td className="py-1 tabular-nums text-gray-900">{formatCOP(b.value)}</td>
                <td className="py-1 tabular-nums text-gray-500">{b.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
