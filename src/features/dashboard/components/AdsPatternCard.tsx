'use client'

import { formatCOP } from '@/shared/utils/format'
import { computeAdsPatternInsight } from '../lib/ads-pattern-insight'
import { MiniBarChart } from './MiniBarChart'
import type { HistoryBucket } from '../lib/bucket-sales-history'
import type { AdsWeekdayBucket } from '../services/get-ads-weekday-pattern'

function formatCompactCOP(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${Math.round(value)}`
}

function formatRoas(value: number): string {
  return `${value.toFixed(2)}x`
}

export function AdsPatternCard({
  salesBuckets,
  adsBuckets,
}: {
  salesBuckets: HistoryBucket[]
  adsBuckets: AdsWeekdayBucket[]
}) {
  const insight = computeAdsPatternInsight(salesBuckets, adsBuckets)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">¿Vendes más el fin de semana?</h2>
      <p className="mb-4 text-xs text-gray-500">Últimos 30 días, por día de la semana</p>

      <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{insight.message}</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Ventas</h3>
          <MiniBarChart
            buckets={salesBuckets.map((b) => ({
              key: b.key,
              label: b.label,
              value: b.value,
              tooltipDetail: `${b.orderCount} pedidos`,
            }))}
            color="#21B674"
            formatValue={formatCOP}
            formatAxis={formatCompactCOP}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">ROAS de ads</h3>
          <MiniBarChart
            buckets={adsBuckets.map((b) => ({
              key: b.key,
              label: b.label,
              value: b.roas,
              tooltipDetail: `gasto ${formatCOP(b.cost)}`,
            }))}
            color="#8CC63E"
            formatValue={formatRoas}
            formatAxis={formatRoas}
            emptyLabel="No hay gasto de ads registrado en este período."
          />
        </div>
      </div>
    </div>
  )
}
