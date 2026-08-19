'use client'

import { useState } from 'react'
import { MiniBarChart, type MiniBarChartBucket } from '@/features/dashboard/components/MiniBarChart'
import { formatCOP } from '@/shared/utils/format'
import type { CashFlow } from '../services/get-cash-flow'

const VISIBLE_DEPOSITS = 10

function formatDate(iso: string): string {
  // Fecha suelta (YYYY-MM-DD): parsearla directo la corre un día por zona horaria.
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`
  return formatCOP(value)
}

export function CashFlowSection({ flow }: { flow: CashFlow }) {
  const [showAll, setShowAll] = useState(false)

  if (flow.deposits.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Cuándo entra la plata</h2>
        <p className="mt-4 text-sm text-gray-500">
          No hay pagos pendientes de liberar. Todo lo que vendiste ya está disponible.
        </p>
      </div>
    )
  }

  const buckets: MiniBarChartBucket[] = flow.weeks.map((w) => ({
    key: w.key,
    label: w.label,
    value: w.amount,
    tooltipDetail: `${w.count} ${w.count === 1 ? 'depósito' : 'depósitos'}`,
  }))

  const visible = showAll ? flow.deposits : flow.deposits.slice(0, VISIBLE_DEPOSITS)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Cuándo entra la plata</h2>
        <span className="shrink-0 text-sm text-gray-500">{formatCOP(flow.totalPending)} en camino</span>
      </div>

      {/* El plazo sale de los datos, no de una constante: pasó de 3-13 días en
          2025 a 21 hoy, y un texto fijo mentiría cuando ML lo vuelva a mover. */}
      {flow.medianDelayDays !== null && (
        <p className="mt-1 text-sm text-gray-500">
          Mercado Libre retiene cada venta unos {flow.medianDelayDays} días
        </p>
      )}

      <div className="mt-4">
        <MiniBarChart
          buckets={buckets}
          color="#21B674"
          formatValue={formatCOP}
          formatAxis={compact}
          emptyLabel="No hay pagos pendientes."
        />
        <p className="mt-1 text-center text-xs text-gray-400">semanas desde hoy</p>
      </div>

      <div className="mt-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Próximos depósitos
        </h3>
        <ul className="mt-2 divide-y divide-gray-100">
          {visible.map((d) => (
            <li key={d.date} className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-sm text-gray-700">{formatDate(d.date)}</span>
              <span className="flex items-baseline gap-3">
                <span className="text-xs text-gray-400">
                  {d.count} {d.count === 1 ? 'venta' : 'ventas'} del {d.soldOn}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                  {formatCOP(d.amount)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {flow.deposits.length > VISIBLE_DEPOSITS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 text-sm font-medium text-happy-greenText hover:underline"
          >
            {showAll ? 'Ver menos' : `Ver los ${flow.deposits.length} depósitos`}
          </button>
        )}
      </div>
    </div>
  )
}
