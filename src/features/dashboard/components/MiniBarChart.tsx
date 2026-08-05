'use client'

import { useMemo, useState } from 'react'

export interface MiniBarChartBucket {
  key: string
  label: string
  value: number
  tooltipDetail?: string
}

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

function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return ''
  const r = Math.min(radius, width / 2, height)
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
}

/**
 * Reusable single-hue bar chart (sequential/magnitude color job, per the
 * dataviz skill) with hairline gridlines, hover+focus tooltip, and a
 * direct label on the peak bar. One series per instance — for a second
 * measure of a different scale, render a second chart, never a dual axis.
 */
export function MiniBarChart({
  buckets,
  color,
  formatValue,
  formatAxis,
  emptyLabel = 'No hay datos en este período.',
  showEveryNthLabel = 1,
}: {
  buckets: MiniBarChartBucket[]
  color: string
  formatValue: (value: number) => string
  formatAxis: (value: number) => string
  emptyLabel?: string
  showEveryNthLabel?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const maxValue = useMemo(() => niceMax(Math.max(...buckets.map((b) => b.value), 0)), [buckets])
  const peakIndex = useMemo(() => {
    if (buckets.every((b) => b.value === 0)) return -1
    return buckets.reduce((best, b, i) => (b.value > buckets[best].value ? i : best), 0)
  }, [buckets])

  const hasData = buckets.some((b) => b.value !== 0)
  const n = buckets.length
  const slotWidth = n > 0 ? PLOT_W / n : PLOT_W
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth - 4)

  const gridLines = [0, 0.5, 1].map((f) => ({
    y: PAD_TOP + PLOT_H * (1 - f),
    label: formatAxis(maxValue * f),
  }))

  if (!hasData) {
    return <p className="py-12 text-center text-sm text-gray-500">{emptyLabel}</p>
  }

  return (
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
          const barHeight = maxValue > 0 ? (Math.max(b.value, 0) / maxValue) * PLOT_H : 0
          const slotX = PAD_LEFT + i * slotWidth
          const barX = slotX + (slotWidth - barWidth) / 2
          const barY = PAD_TOP + PLOT_H - barHeight
          const showLabel = i % showEveryNthLabel === 0

          return (
            <g key={b.key}>
              <path
                d={roundedTopBarPath(barX, barY, barWidth, barHeight, BAR_RADIUS)}
                fill={color}
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
                  {formatAxis(b.value)}
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
                aria-label={`${b.label}: ${formatValue(b.value)}${b.tooltipDetail ? `, ${b.tooltipDetail}` : ''}`}
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
          <p className="font-semibold text-gray-900">{formatValue(buckets[hovered].value)}</p>
          <p className="text-gray-500">
            {buckets[hovered].label}
            {buckets[hovered].tooltipDetail ? ` · ${buckets[hovered].tooltipDetail}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
