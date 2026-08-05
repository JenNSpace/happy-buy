'use client'

import { useState } from 'react'
import { formatCOP } from '@/shared/utils/format'

type Mode = 'units' | 'adBudget'

export function Calculator({
  marginRate,
  breakEvenRoas,
  avgUnitPrice,
}: {
  marginRate: number
  breakEvenRoas: number
  avgUnitPrice: number
}) {
  const [mode, setMode] = useState<Mode>('units')
  const [target, setTarget] = useState('')

  const targetNumber = Number(target) || 0
  const unitsNeeded =
    marginRate > 0 && avgUnitPrice > 0 ? Math.ceil(targetNumber / (marginRate * avgUnitPrice)) : 0
  const maxAdBudget = breakEvenRoas > 0 ? targetNumber / breakEvenRoas : 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Calculadora</h2>

      <div className="mb-4 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode('units')}
          className={`rounded-md px-3 py-1 ${
            mode === 'units' ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Unidades para ganar $X
        </button>
        <button
          type="button"
          onClick={() => setMode('adBudget')}
          className={`rounded-md px-3 py-1 ${
            mode === 'adBudget' ? 'bg-happy-green text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Presupuesto máximo de ads
        </button>
      </div>

      <label className="block text-sm font-medium text-gray-700">
        {mode === 'units' ? '¿Cuánto quieres ganar?' : '¿Cuánto quieres vender de más?'}
      </label>
      <input
        type="number"
        min={0}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Monto en COP"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
      />

      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
        {mode === 'units' ? (
          <p>
            Necesitas vender <span className="font-semibold text-happy-greenDark">{unitsNeeded}</span>{' '}
            unidades
          </p>
        ) : (
          <p>
            Puedes invertir hasta{' '}
            <span className="font-semibold text-happy-greenDark">{formatCOP(maxAdBudget)}</span> en ads
          </p>
        )}
      </div>
    </div>
  )
}
