'use client'

import { useMemo, useState } from 'react'
import { formatCOP } from '@/shared/utils/format'
import {
  bucketSalesHistory,
  filterByRange,
  type HistoryGranularity,
  type HistoryMetric,
} from '../lib/bucket-sales-history'
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

const CHART_W = 800
const CHART_H = 260
const PAD_LEFT = 56
const PAD_RIGHT = 12
const PAD_TOP = 24
const PAD_BOTTOM = 32
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM
const MAX_BAR_WIDTH = 24
const BAR_RADIUS = 4

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return niceNormalized * magnitude
}

function formatCompactCOP(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${Math.round(value)}`
}

function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return ''
  const r = Math.min(radius, width / 2, height)
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
}

export function SalesHistoryCard({ points }: { points: SalesHistoryPoint[] }) {
  const [rangeDays, setRangeDays] = useState(30)
  const [granularity, setGranularity] = useState<HistoryGranularity>('week')
  const [metric, setMetric] = useState<HistoryMetric>('grossSales')
  const [hovered, setHovered] = useState<number | null>(null)

  const buckets = useMemo(() => {
    const filtered = filterByRange(points, rangeDays)
    return bucketSalesHistory(filtered, granularity, metric)
  }, [points, rangeDays, granularity, metric])

  const maxValue = useMemo(() => niceMax(Math.max(...buckets.map((b) => b.value), 0)), [buckets])
  const peakIndex = useMemo(() => {
    if (buckets.every((b) => b.value === 0)) return -1
    return buckets.reduce((best, b, i) => (b.value > buckets[best].value ? i : best), 0)
  }, [buckets])

  const hasData = buckets.some((b) => b.orderCount > 0)
  const n = buckets.length
  const slotWidth = n > 0 ? PLOT_W / n : PLOT_W
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth - 4)

  const gridLines = [0, 0.5, 1].map((f) => ({
    y: PAD_TOP + PLOT_H * (1 - f),
    label: formatCompactCOP(maxValue * f),
  }))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Historial de ventas</h2>
        {peakIndex >= 0 && (
          <span className="text-sm text-gray-500">
            Pico: {buckets[peakIndex].label} · {formatCOP(buckets[peakIndex].value)}
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

      {!hasData ? (
        <p className="py-12 text-center text-sm text-gray-500">No hay ventas en este período.</p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" style={{ width: '100%', height: 240 }}>
            {gridLines.map((g, i) => (
              <g key={i}>
                <line x1={PAD_LEFT} y1={g.y} x2={CHART_W - PAD_RIGHT} y2={g.y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={PAD_LEFT - 8} y={g.y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b7280">
                  {g.label}
                </text>
              </g>
            ))}

            {buckets.map((b, i) => {
              const barHeight = maxValue > 0 ? (b.value / maxValue) * PLOT_H : 0
              const slotX = PAD_LEFT + i * slotWidth
              const barX = slotX + (slotWidth - barWidth) / 2
              const barY = PAD_TOP + PLOT_H - barHeight
              const showLabel = granularity !== 'hour' || i % 3 === 0

              return (
                <g key={b.key}>
                  <path
                    d={roundedTopBarPath(barX, barY, barWidth, barHeight, BAR_RADIUS)}
                    fill="#21B674"
                    opacity={hovered === null || hovered === i ? 1 : 0.55}
                  />
                  {i === peakIndex && barHeight > 0 && (
                    <text
                      x={slotX + slotWidth / 2}
                      y={barY - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill="#111827"
                    >
                      {formatCompactCOP(b.value)}
                    </text>
                  )}
                  {showLabel && (
                    <text
                      x={slotX + slotWidth / 2}
                      y={CHART_H - PAD_BOTTOM + 16}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#6b7280"
                    >
                      {b.label}
                    </text>
                  )}
                  <rect
                    x={slotX}
                    y={PAD_TOP}
                    width={slotWidth}
                    height={PLOT_H}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${b.label}: ${formatCOP(b.value)}, ${b.orderCount} pedidos`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                </g>
              )
            })}
          </svg>

          {hovered !== null && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
              style={{ left: `${((PAD_LEFT + hovered * slotWidth + slotWidth / 2) / CHART_W) * 100}%` }}
            >
              <p className="font-semibold text-gray-900">{formatCOP(buckets[hovered].value)}</p>
              <p className="text-gray-500">
                {buckets[hovered].label} · {buckets[hovered].orderCount} pedidos
              </p>
            </div>
          )}
        </div>
      )}

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
