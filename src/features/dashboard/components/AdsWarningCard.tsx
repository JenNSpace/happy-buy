import { formatCOP } from '@/shared/utils/format'
import type { AdsSummary } from '../types'

export function AdsWarningCard({ ads }: { ads: AdsSummary | null }) {
  if (!ads) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Mercado Ads</h2>
        <p className="mt-2 text-sm text-gray-500">No hay campañas activas en este período.</p>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm ${
        ads.isLosingMoney ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Mercado Ads</h2>
        <span className="text-sm text-gray-500">{ads.campaignName}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Gastado</p>
          <p className="text-lg font-semibold text-gray-900">{formatCOP(ads.cost)}</p>
        </div>
        <div>
          <p className="text-gray-500">Ventas atribuidas</p>
          <p className="text-lg font-semibold text-gray-900">{formatCOP(ads.attributedSales)}</p>
        </div>
        <div>
          <p className="text-gray-500">ROAS real</p>
          <p className="text-lg font-semibold text-gray-900">
            {ads.roas.toFixed(2)}x{' '}
            <span
              className={`text-xs font-normal ${ads.roas >= ads.roasTarget ? 'text-happy-greenDark' : 'text-red-600'}`}
            >
              (objetivo {ads.roasTarget.toFixed(1)}x)
            </span>
          </p>
        </div>
        <div>
          <p className="text-gray-500">ROAS de equilibrio</p>
          <p className="text-lg font-semibold text-gray-900">{ads.breakEvenRoas.toFixed(1)}x</p>
        </div>
      </div>

      {ads.roas < ads.roasTarget && (
        <p className="mt-3 text-xs text-gray-500">
          Tu ROAS objetivo (el que tú configuras en Mercado Ads) es {ads.roasTarget.toFixed(1)}x — el
          algoritmo todavía no lo alcanza con el presupuesto/competencia actual.
        </p>
      )}

      {ads.isLosingMoney && (
        <p className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          Con tu margen actual necesitas {ads.breakEvenRoas.toFixed(1)}x de ROAS para no perder
          plata en ads. Estás en {ads.roas.toFixed(2)}x — esta campaña está perdiendo dinero.
        </p>
      )}
    </div>
  )
}
