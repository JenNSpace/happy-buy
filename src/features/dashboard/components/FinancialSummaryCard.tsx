import { formatCOP, formatPercent } from '@/shared/utils/format'
import type { AdsSummary, FinancialSummary } from '../types'

const pedidos = (n: number) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`

/**
 * A single cost line. Costs are deliberately NOT red: every line here is an
 * expected, unavoidable cost, so painting them all red made the card scream
 * uniformly and hid the one number that actually changes color meaningfully —
 * the profit. Red is reserved for a losing week; green only for money coming
 * back in (the Flex shipping bonus).
 */
function Line({ label, hint, value, credit }: { label: string; hint?: string; value: number; credit?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-600">
        {label}
        {hint && <span className="ml-1.5 text-xs text-gray-400">{hint}</span>}
      </span>
      <span className={`shrink-0 text-sm tabular-nums ${credit ? 'text-happy-greenText' : 'text-gray-700'}`}>
        {credit ? '+' : '−'}
        {formatCOP(value)}
      </span>
    </div>
  )
}

/**
 * Costs grouped by who gets the money, each with its own subtotal. The subtotal
 * steps UP a size from its line items (14px items → 16px subtotal → 36px hero)
 * so the hierarchy is readable by size, not only by weight and color.
 */
function Group({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
        {/* formatCOP already signs negatives — only prefix when the total is a positive cost. */}
        <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
          {total >= 0 ? '−' : ''}
          {formatCOP(total)}
        </span>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function FinancialSummaryCard({ summary, ads }: { summary: FinancialSummary; ads: AdsSummary | null }) {
  const adsCost = ads?.cost ?? 0
  const netProfitAfterAds = summary.netProfit - adsCost
  const isProfitable = netProfitAfterAds > 0
  const marginAfterAds = summary.grossSales > 0 ? netProfitAfterAds / summary.grossSales : 0

  // Grouped by who ends up with the money — the three groups plus ads sum to
  // exactly (ventas brutas − ganancia real), so the card reads as one waterfall.
  const mlTotal = summary.mlCommission + summary.shippingCost - summary.shippingBonus
  const operacionTotal = summary.productCost + summary.bodegaFee + summary.flexCourierFee
  const otrosTotal = summary.taxWithholding + adsCost

  if (summary.orderCount === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ganancia real</h2>
          <span className="text-sm text-gray-500">{summary.periodLabel}</span>
        </div>
        <p className="text-3xl font-bold tracking-tight text-gray-500">Sin ventas todavía</p>
        <p className="mt-2 text-sm text-gray-500">
          {adsCost > 0
            ? `Lo único que corre esta semana es la publicidad: ${formatCOP(adsCost)}.`
            : 'Todavía no hay movimiento esta semana.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Ganancia real</h2>
        <span className="text-sm text-gray-500">{summary.periodLabel}</span>
      </div>

      {/* The hero is the profit — the card is named after it. Gross sales are the
          starting point of the waterfall below, not the headline. */}
      {/* greenDark, not green: #21B674 only reaches 2.62:1 on white and fails
          WCAG even for large text — the one number this card exists to show
          must not read as washed out. */}
      <p
        className={`mt-4 text-4xl font-bold tracking-tight tabular-nums ${
          isProfitable ? 'text-happy-greenDark' : 'text-red-600'
        }`}
      >
        {formatCOP(netProfitAfterAds)}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        {formatPercent(marginAfterAds)} de margen · {pedidos(summary.orderCount)} · {summary.unitsSold}{' '}
        {summary.unitsSold === 1 ? 'unidad' : 'unidades'}
      </p>

      <div className="mt-5 flex items-baseline justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
        <span className="text-sm font-medium text-gray-700">Ventas brutas</span>
        <span className="shrink-0 text-base font-bold tabular-nums text-gray-900">
          {formatCOP(summary.grossSales)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <Group title="Mercado Libre" total={mlTotal}>
          <Line label="Comisión por venta" value={summary.mlCommission} />
          <Line
            label="Envío por agencia"
            hint={`· ${pedidos(summary.agenciaOrderCount)}`}
            value={summary.shippingCost}
          />
          {summary.shippingBonus > 0 && (
            <Line
              label="Bonificación por Flex"
              hint={`· ${pedidos(summary.flexOrderCount)} · ML te devuelve`}
              value={summary.shippingBonus}
              credit
            />
          )}
        </Group>

        <Group title="Tu operación" total={operacionTotal}>
          <Line label="Costo del producto" value={summary.productCost} />
          <Line label="Bodega · Gina y Daniel" value={summary.bodegaFee} />
          {summary.flexCourierFee > 0 && (
            <Line
              label="Courier Flex externo"
              hint={`· ${pedidos(summary.flexOrderCount)}`}
              value={summary.flexCourierFee}
            />
          )}
        </Group>

        <Group title="Impuestos y publicidad" total={otrosTotal}>
          <Line label="Retenciones" hint="· estimado 1,5%" value={summary.taxWithholding} />
          <Line label="Publicidad · Mercado Ads" value={adsCost} />
        </Group>
      </div>
    </div>
  )
}
