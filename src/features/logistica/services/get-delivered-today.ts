import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { createClient } from '@/lib/supabase/server'
import { getBogotaTodayStart } from '../utils/dispatch-cutoff'

interface MlShipmentItem {
  id: string
  description: string
  quantity: number
}

interface MlShipment {
  shipping_items: MlShipmentItem[]
}

export interface DeliveredShipment {
  shipmentId: number
  items: { itemId: string; description: string; quantity: number }[]
  deliveredAt: string
}

/**
 * So "Marcar entregado" doesn't just make the package vanish — the user
 * asked to still see what she's handed off today, as a running checklist
 * of her own day's work rather than losing the record. RLS on `shipments`
 * already scopes this to the caller's own warehouse.
 */
export async function getDeliveredToday(): Promise<DeliveredShipment[]> {
  const supabase = await createClient()
  const { data: localShipments } = await supabase
    .from('shipments')
    .select('id, delivered_at')
    .not('delivered_at', 'is', null)
    .gte('delivered_at', getBogotaTodayStart())
    .order('delivered_at', { ascending: false })

  if (!localShipments || localShipments.length === 0) return []

  const details = await Promise.all(
    localShipments.map((s) => mlGet<MlShipment>(`/shipments/${s.id}`))
  )

  return localShipments.map((s, i) => ({
    shipmentId: s.id,
    items: details[i].shipping_items.map((item) => ({
      itemId: item.id,
      description: item.description,
      quantity: item.quantity,
    })),
    deliveredAt: s.delivered_at as string,
  }))
}
