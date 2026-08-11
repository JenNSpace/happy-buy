import { formatCOP } from '@/shared/utils/format'
import type { WarehouseEarnings } from '../services/get-warehouse-earnings'

function currentMonthName(): string {
  return new Date().toLocaleDateString('es-CO', { month: 'long', timeZone: 'America/Bogota' })
}

/**
 * Lightweight preview of what a future Finanzas tab (Fase 3) will own —
 * the user explicitly said the full page can wait, but wants totals owed
 * to each warehouse visible "somewhere" in the meantime.
 */
export function AdminEarningsSummary({ earnings }: { earnings: WarehouseEarnings[] }) {
  const withPackages = earnings.filter((e) => e.totalPackages > 0)
  if (withPackages.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Se debe por entregas de {currentMonthName()}
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {withPackages.map((e) => (
          <p key={e.warehouseId} className="text-sm text-gray-700">
            <span className="font-semibold">{e.warehouseName}:</span> {e.totalPackages} paquetes ·{' '}
            <span className="font-semibold text-happy-greenDark">{formatCOP(e.totalAmount)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
