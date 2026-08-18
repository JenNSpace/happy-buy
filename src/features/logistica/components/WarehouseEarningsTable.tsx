import { formatCOP } from '@/shared/utils/format'
import { getFortnightLabel } from '../utils/dispatch-cutoff'
import type { WarehouseEarnings } from '../services/get-warehouse-earnings'

export function WarehouseEarningsTable({ earnings }: { earnings: WarehouseEarnings }) {
  return (
    <div className="mt-8">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">Tu quincena · {getFortnightLabel()}</h3>
      <p className="mb-3 text-xs text-gray-400">
        {earnings.feePerPackageFlex === earnings.feePerPackageAgencia
          ? `${formatCOP(earnings.feePerPackageAgencia)} por paquete entregado`
          : `${formatCOP(earnings.feePerPackageFlex)} por paquete Flex · ${formatCOP(earnings.feePerPackageAgencia)} por paquete de agencia`}
      </p>

      {earnings.daily.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay paquetes entregados en esta quincena.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase text-gray-400">
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2 text-right">Paquetes</th>
                <th className="px-4 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {earnings.daily.map((d) => (
                <tr key={d.date} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{d.packages}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCOP(d.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{earnings.totalPackages}</td>
                <td className="px-4 py-2 text-right text-happy-greenDark">{formatCOP(earnings.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
