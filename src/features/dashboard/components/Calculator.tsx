'use client'

import { useState } from 'react'
import { formatCOP } from '@/shared/utils/format'
import type { AdsSummary } from '../types'

type Mode = 'units' | 'adBudget'

export function Calculator({
  marginRate,
  avgUnitPrice,
  ads,
}: {
  marginRate: number
  avgUnitPrice: number
  ads: AdsSummary | null
}) {
  const [mode, setMode] = useState<Mode>('adBudget')
  const [profitTarget, setProfitTarget] = useState('')
  const [extraSpend, setExtraSpend] = useState('')

  const profitTargetNumber = Number(profitTarget) || 0
  const unitsNeeded =
    marginRate > 0 && avgUnitPrice > 0 ? Math.ceil(profitTargetNumber / (marginRate * avgUnitPrice)) : 0

  const extraSpendNumber = Number(extraSpend) || 0
  const roas = ads?.roas ?? 0
  // Extra revenue from the extra spend (assuming ROAS holds) times the real
  // product margin, minus the extra spend itself — the same relationship
  // breakEvenRoas is built from (roas * marginRate = 1 at break-even).
  const extraProfit = extraSpendNumber * (roas * marginRate - 1)
  const worthIt = extraProfit > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Calculadora</h2>

      <div className="mb-4 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode('adBudget')}
          className={`rounded-md px-3 py-1 ${
            mode === 'adBudget' ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          ¿Vale la pena subir ads?
        </button>
        <button
          type="button"
          onClick={() => setMode('units')}
          className={`rounded-md px-3 py-1 ${
            mode === 'units' ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Unidades para ganar $X
        </button>
      </div>

      {mode === 'adBudget' ? (
        !ads ? (
          <p className="text-sm text-gray-500">No hay campaña de ads activa para analizar.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700">
              ¿Cuánto más quieres invertir en ads por día?
            </label>
            <input
              type="number"
              min={0}
              value={extraSpend}
              onChange={(e) => setExtraSpend(e.target.value)}
              placeholder="Monto en COP"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
            />

            <div
              className={`mt-4 rounded-lg p-3 text-sm ${worthIt ? 'bg-happy-green/10' : 'bg-red-50'}`}
            >
              {extraSpendNumber > 0 ? (
                <>
                  <p className={worthIt ? 'text-happy-greenDark' : 'text-red-700'}>
                    {worthIt ? (
                      <>
                        Si tu ROAS actual ({roas.toFixed(2)}x) se mantiene, esto te dejaría aprox.{' '}
                        <span className="font-semibold">{formatCOP(extraProfit)}</span> más de ganancia al
                        día.
                      </>
                    ) : (
                      <>
                        Con tu ROAS actual ({roas.toFixed(2)}x) esto te haría perder aprox.{' '}
                        <span className="font-semibold">{formatCOP(Math.abs(extraProfit))}</span> al día —
                        necesitas mínimo {ads.breakEvenRoas.toFixed(1)}x de ROAS para que valga la pena.
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Ojo: el ROAS casi siempre baja un poco al subir presupuesto (se satura la demanda) —
                    sube de a poco y mide 3-5 días antes de volver a subir.
                  </p>
                </>
              ) : (
                <p className="text-gray-600">
                  Presupuesto actual: {formatCOP(ads.budget)}/día · ROAS actual: {roas.toFixed(2)}x ·
                  necesitas {ads.breakEvenRoas.toFixed(1)}x para no perder.
                </p>
              )}
            </div>
          </>
        )
      ) : (
        <>
          <label className="block text-sm font-medium text-gray-700">¿Cuánto quieres ganar?</label>
          <input
            type="number"
            min={0}
            value={profitTarget}
            onChange={(e) => setProfitTarget(e.target.value)}
            placeholder="Monto en COP"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
          />

          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
            <p>
              Necesitas vender <span className="font-semibold text-happy-greenDark">{unitsNeeded}</span>{' '}
              unidades
            </p>
          </div>
        </>
      )}
    </div>
  )
}
