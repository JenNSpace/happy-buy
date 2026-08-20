import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { mlGet } from '@/features/dashboard/services/ml-client'
import { feeFor } from './get-warehouse-ledger'

/**
 * La cuenta de cobro, generada por el sistema en vez de recibida desde el
 * cuaderno de la bodega.
 *
 * **Por qué se invierte la dirección.** Gina armaba su cuenta a mano y el
 * 2026-08-18 le faltaron dos envíos: cobró $78.000 cuando le correspondían
 * $84.800. El error no se detectó comparando totales sino **bajando al envío
 * individual** — al darle producto, comprador, ciudad y hora exacta reconoció
 * en un minuto los dos que había olvidado anotar. Si el sistema arma el detalle
 * y ella solo confirma o reclama, esa diferencia no nace.
 *
 * Por eso cada línea trae el **número de venta que ella ve en Mercado Libre**
 * (el `pack_id`, no el id de la orden — ver la memoria del proyecto): sin ese
 * número no puede cruzarlo contra su propio registro.
 */
export interface StatementLine {
  shipmentId: number
  /** El número que Gina ve en su pantalla de ML. */
  saleNumber: string
  /** Fecha y hora de despacho, Bogotá. */
  dispatchedAt: string
  channel: 'flex' | 'agencia'
  fee: number
  product: string
  buyer: string
}

export interface BillingStatement {
  warehouseId: string
  warehouseName: string
  from: string
  to: string
  lines: StatementLine[]
  packagesTotal: number
  packagesAmount: number
  adjustments: { note: string; amount: number }[]
  adjustmentsAmount: number
  total: number
}

interface ShipmentRow {
  id: number
  order_id: number
  delivered_at: string
  fulfillment_type: string | null
}

interface MlOrder {
  pack_id: number | null
  id: number
  buyer: { nickname: string }
  order_items: { item: { title: string }; quantity: number }[]
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/**
 * Arma la cuenta de un rango de fechas. El rango es **inclusivo en los dos
 * extremos**: "del 1 al 18" incluye el 18 completo, que es como lo lee una
 * persona y como lo escribió Gina en su cuenta.
 */
export async function getBillingStatement(
  warehouseId: string,
  from: string,
  to: string
): Promise<BillingStatement | null> {
  const supabase = await createClient()

  const [{ data: warehouse }, { data: shipments }, { data: adjustments }] = await Promise.all([
    supabase
      .from('warehouses')
      .select('id, name, fee_per_package_flex, fee_per_package_agencia')
      .eq('id', warehouseId)
      .single<{ id: string; name: string; fee_per_package_flex: number; fee_per_package_agencia: number }>(),
    supabase
      .from('shipments')
      .select('id, order_id, delivered_at, fulfillment_type')
      .eq('warehouse_id', warehouseId)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', `${from}T00:00:00-05:00`)
      .lt('delivered_at', `${nextDay(to)}T00:00:00-05:00`)
      .order('delivered_at')
      .returns<ShipmentRow[]>(),
    supabase
      .from('warehouse_adjustments')
      .select('note, amount_delta, period_start')
      .eq('warehouse_id', warehouseId)
      .gte('period_start', from)
      .lte('period_start', to)
      .returns<{ note: string; amount_delta: number; period_start: string }[]>(),
  ])

  if (!warehouse) return null

  const fees = { feeFlex: warehouse.fee_per_package_flex, feeAgencia: warehouse.fee_per_package_agencia }
  const rows = shipments ?? []

  // Una orden por envío. Si ML no responde por alguna, la línea igual aparece
  // con lo que sabemos localmente: perder un envío de la cuenta es peor que
  // mostrarlo sin el nombre del comprador.
  const orders = await Promise.all(
    rows.map(async (s) => {
      try {
        return await mlGet<MlOrder>(`/orders/${s.order_id}`)
      } catch {
        return null
      }
    })
  )

  const lines: StatementLine[] = rows.map((s, i) => {
    const order = orders[i]
    return {
      shipmentId: s.id,
      saleNumber: String(order?.pack_id ?? order?.id ?? s.order_id),
      dispatchedAt: s.delivered_at,
      channel: s.fulfillment_type === 'flex' ? 'flex' : 'agencia',
      fee: feeFor(s.fulfillment_type, fees),
      product: order?.order_items?.[0]?.item?.title ?? 'Producto no disponible',
      buyer: order?.buyer?.nickname ?? '—',
    }
  })

  const packagesAmount = lines.reduce((sum, l) => sum + l.fee, 0)
  const adj = (adjustments ?? []).map((a) => ({ note: a.note, amount: Number(a.amount_delta) }))
  const adjustmentsAmount = adj.reduce((sum, a) => sum + a.amount, 0)

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    from,
    to,
    lines,
    packagesTotal: lines.length,
    packagesAmount,
    adjustments: adj,
    adjustmentsAmount,
    total: packagesAmount + adjustmentsAmount,
  }
}
