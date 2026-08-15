import { getShortProductName } from '../utils/product-name'
import type { DeliveredShipment } from '../services/get-delivered-today'

export function DeliveredTodaySection({
  shipments,
  shortNames,
}: {
  shipments: DeliveredShipment[]
  shortNames: Record<string, string>
}) {
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        Entregados hoy <span className="text-gray-400">({shipments.length})</span>
      </h3>

      {shipments.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no has marcado ninguno como entregado hoy.</p>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => (
            <div key={s.shipmentId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
              <div>
                {s.items.map((item, i) => (
                  <p key={i} className="text-sm text-gray-600">
                    <span className="font-semibold">{item.quantity}×</span>{' '}
                    {getShortProductName(shortNames, item.itemId, item.description)}
                  </p>
                ))}
              </div>
              <span className="whitespace-nowrap text-xs text-happy-greenDark">
                ✓ {new Date(s.deliveredAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
