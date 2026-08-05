'use client'

import { useState } from 'react'
import { formatCOP, formatPercent } from '@/shared/utils/format'
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
  const [expectedRoas, setExpectedRoas] = useState(() => (ads ? ads.roas.toFixed(2) : ''))

  const profitTargetNumber = Number(profitTarget) || 0
  const unitsNeeded =
    marginRate > 0 && avgUnitPrice > 0 ? Math.ceil(profitTargetNumber / (marginRate * avgUnitPrice)) : 0

  const extraSpendNumber = Number(extraSpend) || 0
  const expectedRoasNumber = Number(expectedRoas) || 0
  // Por cada peso invertido de más, esperas recuperar expectedRoas pesos en
  // ventas; de esos, tu margen real se queda con marginRate. Si ese producto
  // supera 1, cada peso extra deja ganancia; si no, deja pérdida.
  const extraProfit = extraSpendNumber * (expectedRoasNumber * marginRate - 1)
  const worthIt = extraProfit > 0
  const breakEvenForMargin = marginRate > 0 ? 1 / marginRate : 0

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Más presupuesto/día</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={extraSpend}
                  onChange={(e) => setExtraSpend(e.target.value)}
                  placeholder="Monto en COP"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ROAS que esperas</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={expectedRoas}
                  onChange={(e) => setExpectedRoas(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Precargado con tu ROAS actual ({ads.roas.toFixed(2)}x) — cámbialo si crees que va a mejorar
              o empeorar al subir presupuesto.
            </p>

            <div
              className={`mt-4 rounded-lg p-3 text-sm ${worthIt ? 'bg-happy-green/10' : 'bg-red-50'}`}
            >
              {extraSpendNumber > 0 && expectedRoasNumber > 0 ? (
                <p className={worthIt ? 'text-happy-greenDark' : 'text-red-700'}>
                  Con un ROAS de {expectedRoasNumber.toFixed(2)}x, subir {formatCOP(extraSpendNumber)}/día
                  te dejaría{' '}
                  <span className="font-semibold">
                    {worthIt ? '+' : '-'}
                    {formatCOP(Math.abs(extraProfit))}
                  </span>{' '}
                  de ganancia al día.
                </p>
              ) : (
                <p className="text-gray-600">
                  Presupuesto actual: {formatCOP(ads.budget)}/día · ROAS actual: {ads.roas.toFixed(2)}x
                </p>
              )}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-happy-green hover:underline">
                ¿Cómo se calcula esto?
              </summary>
              <div className="mt-2 space-y-1 text-xs text-gray-500">
                <p>
                  Tu margen real (después de comisión de ML, envío, costo del producto y despacho) es{' '}
                  {formatPercent(marginRate)} de cada venta.
                </p>
                <p>
                  Con ese margen, necesitas mínimo <strong>{breakEvenForMargin.toFixed(2)}x de ROAS</strong>{' '}
                  para que un peso extra en ads no sea pérdida — por debajo de eso, entre más vendes con
                  ads, más pierdes, aunque las ventas suban.
                </p>
                <p>
                  Fórmula: presupuesto extra × (ROAS esperado × tu margen − 1) = ganancia o pérdida extra.
                </p>
              </div>
            </details>
          </>
        )
      ) : (
        <>
          <label className="block text-sm font-medium text-gray-700">¿Cuánto quieres ganar?</label>
          <input
            type="number"
            min={0}
            step={1}
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
