import { formatCOP, formatPercent } from '@/shared/utils/format'
import type { FinancialSummary } from '../types'

function Row({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={negative ? 'text-red-600' : 'text-gray-900'}>
        {negative ? '-' : ''}
        {formatCOP(value)}
      </span>
    </div>
  )
}

export function FinancialSummaryCard({ summary }: { summary: FinancialSummary }) {
  const isProfitable = summary.netProfit > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Ganancia real</h2>
        <span className="text-sm text-gray-500">{summary.periodLabel}</span>
      </div>

      <Row label="Ventas brutas" value={summary.grossSales} />
      <Row label="Comisión Mercado Libre (11.5%)" value={summary.mlCommission} negative />
      <Row label="Envío" value={summary.shippingCost} negative />
      <Row label="Costo del producto (iHerb)" value={summary.productCost} negative />
      <Row label="Pago a despacho" value={summary.fulfillmentFee} negative />

      <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 p-3">
        <span className="font-semibold text-gray-900">Ganancia neta</span>
        <span className={`text-xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
          {formatCOP(summary.netProfit)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-gray-600">Margen neto</span>
        <span className="font-medium text-gray-900">{formatPercent(summary.marginRate)}</span>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        {summary.orderCount} pedidos · {summary.unitsSold} unidades vendidas
      </p>
    </div>
  )
}
