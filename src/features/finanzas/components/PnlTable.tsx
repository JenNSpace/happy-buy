import { formatCOP, formatPercent } from '@/shared/utils/format'
import type { PnlMonth } from '../services/get-pnl'
import { SURFACE_CARD, EYEBROW } from '@/shared/ui/surface'

/** Una fila de costo. Gris con "−", nunca roja: son costos esperados, no alarmas. */
function Row({
  label,
  months,
  pick,
  credit,
}: {
  label: string
  months: PnlMonth[]
  pick: (m: PnlMonth) => number
  credit?: boolean
}) {
  if (months.every((m) => pick(m) === 0)) return null

  return (
    <tr>
      <th scope="row" className="py-1.5 pr-4 text-left text-sm font-normal text-gray-600">
        {label}
      </th>
      {months.map((m) => {
        const value = pick(m)
        return (
          <td
            key={m.key}
            className={`py-1.5 pl-4 text-right text-sm tabular-nums ${
              credit ? 'text-happy-greenText' : 'text-gray-700'
            }`}
          >
            {value === 0 ? '—' : `${credit ? '+' : '−'}${formatCOP(value)}`}
          </td>
        )
      })}
    </tr>
  )
}

/**
 * Fila cuyo signo cambia por mes: puede ser cargo o crédito. El color sigue al
 * signo — verde solo cuando de verdad entra plata.
 */
function SignedRow({
  label,
  months,
  pick,
}: {
  label: string
  months: PnlMonth[]
  pick: (m: PnlMonth) => number
}) {
  if (months.every((m) => Math.abs(pick(m)) < 1)) return null

  return (
    <tr>
      <th scope="row" className="py-1.5 pr-4 text-left text-sm font-normal text-gray-600">
        {label}
      </th>
      {months.map((m) => {
        const value = pick(m)
        if (Math.abs(value) < 1) {
          return (
            <td key={m.key} className="py-1.5 pl-4 text-right text-sm tabular-nums text-gray-700">
              —
            </td>
          )
        }
        const isCredit = value < 0
        return (
          <td
            key={m.key}
            className={`py-1.5 pl-4 text-right text-sm tabular-nums ${
              isCredit ? 'text-happy-greenText' : 'text-gray-700'
            }`}
          >
            {isCredit ? '+' : '−'}
            {formatCOP(Math.abs(value))}
          </td>
        )
      })}
    </tr>
  )
}

function GroupHeader({ title, months, total }: { title: string; months: PnlMonth[]; total: (m: PnlMonth) => number }) {
  return (
    <tr className="border-t border-t-gray-900/[0.07]">
      <th
        scope="row"
        className={`pt-3 pr-4 text-left ${EYEBROW}`}
      >
        {title}
      </th>
      {months.map((m) => {
        const value = total(m)
        return (
          <td key={m.key} className="pt-3 pl-4 text-right text-base font-semibold tabular-nums text-gray-900">
            {value >= 0 ? '−' : '+'}
            {formatCOP(Math.abs(value))}
          </td>
        )
      })}
    </tr>
  )
}

export function PnlTable({ months }: { months: PnlMonth[] }) {
  const hasData = months.some((m) => m.orderCount > 0)

  if (!hasData) {
    return (
      <div className={`${SURFACE_CARD} p-6`}>
        <h2 className="text-lg font-semibold text-gray-900">Resultado por mes</h2>
        <p className="mt-4 text-sm text-gray-500">Todavía no hay ventas registradas en estos meses.</p>
      </div>
    )
  }

  const partial = months.find((m) => m.isPartial)

  return (
    <div className={`${SURFACE_CARD} p-6`}>
      <h2 className="text-lg font-semibold text-gray-900">Resultado por mes</h2>
      <p className="mt-1 text-sm text-gray-500">
        Cuenta cada venta el mes que se vendió, no el mes que entra la plata.
      </p>

      {/* La tabla scrollea dentro de su caja; la página nunca de lado. */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse">
          <caption className="sr-only">
            Estado de resultados mensual: ventas, costos y utilidad de los últimos {months.length} meses
          </caption>
          <thead>
            <tr>
              <td />
              {months.map((m) => (
                <th
                  key={m.key}
                  scope="col"
                  className="pb-2 pl-4 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                >
                  {m.label}
                  {m.isPartial && <span className="text-gray-400">*</span>}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr className="border-t border-t-gray-900/[0.12]">
              <th scope="row" className="py-2 pr-4 text-left text-sm font-medium text-gray-700">
                Ventas
              </th>
              {months.map((m) => (
                <td key={m.key} className="py-2 pl-4 text-right text-base font-bold tabular-nums text-gray-900">
                  {formatCOP(m.grossSales)}
                </td>
              ))}
            </tr>

            <GroupHeader
              title="Mercado Libre"
              months={months}
              total={(m) =>
                m.mlCommission + m.shippingCost + m.taxWithholding + m.otherMlCharges - m.shippingBonus
              }
            />
            <Row label="Comisión" months={months} pick={(m) => m.mlCommission} />
            <Row label="Envíos" months={months} pick={(m) => m.shippingCost} />
            <Row label="Retenciones" months={months} pick={(m) => m.taxWithholding} />
            <Row label="Bonificación Flex" months={months} pick={(m) => m.shippingBonus} credit />
            {/* ML factura algunos cargos aparte en vez de descontarlos del pago.
                Casi siempre queda a favor, y se muestra para que la columna sume. */}
            <SignedRow
              label="Ajuste de cargos ML"
              months={months}
              pick={(m) => m.otherMlCharges}
            />

            <GroupHeader
              title="Tu operación"
              months={months}
              total={(m) => m.productCost + m.bodegaFee + m.courierFee + m.expenses}
            />
            <Row label="Producto" months={months} pick={(m) => m.productCost} />
            <Row label="Bodegas" months={months} pick={(m) => m.bodegaFee} />
            <Row label="Courier Flex" months={months} pick={(m) => m.courierFee} />
            <Row label="Empaques" months={months} pick={(m) => m.expenses} />

            <GroupHeader title="Publicidad" months={months} total={(m) => m.ads} />
            <Row label="Mercado Ads" months={months} pick={(m) => m.ads} />
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-t-gray-900/25">
              <th scope="row" className="pt-3 pr-4 text-left text-sm font-semibold text-gray-900">
                Utilidad
              </th>
              {months.map((m) => (
                <td
                  key={m.key}
                  className={`pt-3 pl-4 text-right text-xl font-bold tabular-nums ${
                    m.netProfit < 0 ? 'text-red-600' : 'text-happy-greenDark'
                  }`}
                >
                  {formatCOP(m.netProfit)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="pr-4 text-left text-sm font-normal text-gray-500">
                Margen
              </th>
              {months.map((m) => (
                <td key={m.key} className="pl-4 text-right text-sm tabular-nums text-gray-500">
                  {formatPercent(m.marginRate)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {partial && (
        <p className="mt-4 text-xs text-gray-400">
          * {partial.label} va en curso — es un mes incompleto y no se compara de igual a igual con los
          anteriores.
        </p>
      )}
    </div>
  )
}
