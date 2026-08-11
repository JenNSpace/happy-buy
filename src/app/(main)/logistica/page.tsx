import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import { getPendingShipmentsForAdmin } from '@/features/logistica/services/get-pending-shipments'
import { getBodegaShipments } from '@/features/logistica/services/get-bodega-shipments'
import { getDeliveredToday } from '@/features/logistica/services/get-delivered-today'
import { getMyWarehouseEarningsThisMonth, getAllWarehouseEarningsThisMonth } from '@/features/logistica/services/get-warehouse-earnings'
import { AdminLogisticsBoard } from '@/features/logistica/components/AdminLogisticsBoard'
import { BodegaShipmentCard } from '@/features/logistica/components/BodegaShipmentCard'
import { DeliveredTodaySection } from '@/features/logistica/components/DeliveredTodaySection'
import { WarehouseEarningsTable } from '@/features/logistica/components/WarehouseEarningsTable'
import { AdminEarningsSummary } from '@/features/logistica/components/AdminEarningsSummary'
import { UrgencyBanner } from '@/features/logistica/components/UrgencyBanner'

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
    const [shipments, { data: warehouses }, allEarnings] = await Promise.all([
      getPendingShipmentsForAdmin(),
      supabase.from('warehouses').select('*').order('name'),
      getAllWarehouseEarningsThisMonth(),
    ])

    return (
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <h2 className="text-2xl font-bold text-gray-900">Logística</h2>
        <AdminEarningsSummary earnings={allEarnings} />
        <AdminLogisticsBoard shipments={shipments} warehouses={warehouses ?? []} />
      </div>
    )
  }

  // Sequential on purpose: getBodegaShipments() may auto-sync a shipment to
  // delivered (see syncAutoDelivered) — getDeliveredToday()/earnings need to
  // run after that write lands, or they'd miss it on this exact page load.
  const shipments = await getBodegaShipments()
  const delivered = await getDeliveredToday()
  const earnings = await getMyWarehouseEarningsThisMonth()
  const name = profile?.full_name ?? 'de nuevo'

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h2 className="mb-1 text-2xl font-bold text-gray-900">
        ¡{greeting()}, {name}! 👋
      </h2>
      <p className="mb-6 text-sm text-gray-500">Aquí están tus envíos de hoy.</p>

      {shipments.length === 0 ? (
        <p className="text-sm text-gray-500">No tienes envíos pendientes por ahora.</p>
      ) : (
        <>
          <UrgencyBanner deadlines={shipments.map((s) => s.deadline)} />
          <div className="space-y-3">
            {shipments.map((s) => (
              <BodegaShipmentCard key={s.shipmentId} shipment={s} />
            ))}
          </div>
        </>
      )}

      <DeliveredTodaySection shipments={delivered} />
      {earnings && <WarehouseEarningsTable earnings={earnings} />}
    </div>
  )
}
