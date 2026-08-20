import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import { getPendingShipmentsForAdmin } from '@/features/logistica/services/get-pending-shipments'
import { getBodegaShipments } from '@/features/logistica/services/get-bodega-shipments'
import { getDeliveredToday } from '@/features/logistica/services/get-delivered-today'
import { getMyWarehouseEarningsThisMonth, getAllWarehouseEarningsThisMonth } from '@/features/logistica/services/get-warehouse-earnings'
import { getAllWarehouseLedgers } from '@/features/logistica/services/get-warehouse-ledger'
import { getPackingMap } from '@/features/inventario/services/get-product-catalog'
import { AdminLogisticsBoard } from '@/features/logistica/components/AdminLogisticsBoard'
import { BodegaShipmentCard } from '@/features/logistica/components/BodegaShipmentCard'
import { DeliveredTodaySection } from '@/features/logistica/components/DeliveredTodaySection'
import { WarehouseEarningsTable } from '@/features/logistica/components/WarehouseEarningsTable'
import { AdminEarningsSummary } from '@/features/logistica/components/AdminEarningsSummary'
import { WarehouseLedgerCard } from '@/features/logistica/components/WarehouseLedgerCard'
import { UrgencyBanner } from '@/features/logistica/components/UrgencyBanner'
import { AutoRefresh } from '@/features/logistica/components/AutoRefresh'
import { UnassignedDispatchedAlert } from '@/features/logistica/components/UnassignedDispatchedAlert'
import {
  syncDispatchedShipments,
  getUnassignedDispatched,
} from '@/features/logistica/services/sync-dispatched'
import { getFullSummary } from '@/features/logistica/services/get-full-summary'

export const dynamic = 'force-dynamic'

function greeting(): string {
  const hour = new Date().getUTCHours() - 5 // Bogotá is UTC-5, fixed offset, no DST
  const bogotaHour = ((hour % 24) + 24) % 24
  if (bogotaHour < 12) return 'Buenos días'
  if (bogotaHour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export default async function LogisticaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single<Profile>()

  if (profile?.role === 'admin') {
    // Sequential first: records shipments dispatched without ever being assigned
    // a warehouse, so the earnings and unassigned lists below see them.
    await syncDispatchedShipments()

    const [shipments, { data: warehouses }, allEarnings, packing, unassigned, fullSummary, ledgers] = await Promise.all([
      getPendingShipmentsForAdmin(),
      // Full never gets packages assigned — ML dispatches it end to end.
      supabase.from('warehouses').select('*').eq('is_fulfillment', false).order('name'),
      getAllWarehouseEarningsThisMonth(),
      getPackingMap(),
      getUnassignedDispatched(),
      getFullSummary(),
      getAllWarehouseLedgers(),
    ])

    return (
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <AutoRefresh />
        <h2 className="text-2xl font-bold text-gray-900">Logística</h2>
        <UnassignedDispatchedAlert rows={unassigned} warehouses={warehouses ?? []} />
        <AdminEarningsSummary earnings={allEarnings} />

        {/* Cuenta corriente: generado − pagado = saldo. Las quincenas de arriba
            siguen sirviendo para ver el detalle del período, pero la respuesta a
            "¿cuánto le debo?" vive acá, y no depende de que la cuenta de cobro
            respete los cortes del calendario. */}
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Cuenta con cada bodega</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {ledgers.map((l) => (
              <WarehouseLedgerCard key={l.warehouseId} ledger={l} />
            ))}
          </div>
        </div>
        <AdminLogisticsBoard
          shipments={shipments}
          warehouses={warehouses ?? []}
          packing={packing}
          fullSummary={fullSummary}
        />
      </div>
    )
  }

  // Sequential on purpose: getBodegaShipments() may auto-sync a shipment to
  // delivered (see syncAutoDelivered) — getDeliveredToday()/earnings need to
  // run after that write lands, or they'd miss it on this exact page load.
  const shipments = await getBodegaShipments()
  const delivered = await getDeliveredToday()
  const earnings = await getMyWarehouseEarningsThisMonth()
  const packing = await getPackingMap()
  const name = profile?.full_name ?? 'de nuevo'

  return (
    <div className="mx-auto max-w-2xl p-8">
      <AutoRefresh />
      <h2 className="mb-1 text-2xl font-bold text-gray-900">
        ¡{greeting()}, {name}! 👋
      </h2>
      <p className="mb-6 text-sm text-gray-500">Aquí están tus envíos de hoy.</p>

      {shipments.length === 0 ? (
        <p className="text-sm text-gray-500">No tienes envíos pendientes por ahora.</p>
      ) : (
        <>
          <UrgencyBanner items={shipments.map((s) => ({ deadline: s.deadline, isLate: s.isLate }))} />
          <div className="space-y-3">
            {shipments.map((s) => (
              <BodegaShipmentCard key={s.shipmentId} shipment={s} packing={packing} />
            ))}
          </div>
        </>
      )}

      <DeliveredTodaySection shipments={delivered} packing={packing} />
      {earnings && <WarehouseEarningsTable earnings={earnings} />}
    </div>
  )
}
