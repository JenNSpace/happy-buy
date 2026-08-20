import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Cuenta corriente de una bodega: generado − pagado = saldo.
 *
 * **Por qué esto reemplaza el modelo de quincenas como cajones.** Enrique paga
 * contra la cuenta de cobro que envía Gina, y esa cuenta llega tarde y cubre el
 * rango que ella decida — el 2026-08-20 pagó "del 1 al 18", que no es ninguna
 * quincena. Con cajones fijos ese pago no se podía registrar sin inventar un
 * período, y la pregunta "¿cuánto le debo?" no tenía una sola respuesta.
 *
 * Con saldo acumulado las fechas dejan de ser estructurales: se cobre por
 * quincena, por 18 días o dos veces en la misma semana, el saldo siempre cuadra.
 * Los rangos quedan como referencia en cada pago, no como la forma del dato.
 */
export interface LedgerPayment {
  id: string
  paidAt: string
  amount: number
  packages: number | null
  /** Rango que la cuenta de cobro decía cubrir — informativo. */
  periodStart: string | null
  periodEnd: string | null
  note: string | null
}

export interface LedgerAdjustment {
  id: string
  amount: number
  note: string
  /** Fecha con la que se registró — informativa, ya no define un cajón. */
  date: string
}

export interface WarehouseLedger {
  warehouseId: string
  warehouseName: string
  feePerPackageFlex: number
  feePerPackageAgencia: number
  packages: number
  /** Plata por paquetes despachados, a la tarifa que corresponde a cada canal. */
  amountFromPackages: number
  /** Etiquetas, extras y correcciones manuales. */
  amountFromAdjustments: number
  /** Todo lo que la bodega se ha ganado. */
  totalGenerated: number
  /** Todo lo que se le ha pagado. */
  totalPaid: number
  /** Lo que falta por pagar. Negativo = se le pagó de más. */
  balance: number
  payments: LedgerPayment[]
  adjustments: LedgerAdjustment[]
}

interface WarehouseRow {
  id: string
  name: string
  fee_per_package_flex: number
  fee_per_package_agencia: number
}

/**
 * La tarifa depende de CÓMO se despachó, no de quién lo despachó (confirmado
 * 2026-08-15): Flex —el courier recoge— paga menos que llevarlo a la agencia.
 * Cualquier cosa que no sea 'flex', incluido null en envíos anteriores a que
 * existiera el campo, se cobra a tarifa de agencia: subcontar el caso caro le
 * quitaría plata a quien hizo el trabajo.
 */
export function feeFor(fulfillmentType: string | null, w: { feeFlex: number; feeAgencia: number }): number {
  return fulfillmentType === 'flex' ? w.feeFlex : w.feeAgencia
}

/** Cuánto generó la bodega en un rango de fechas (Bogotá, ambos extremos incluidos). */
export async function getGeneratedInRange(
  warehouseId: string,
  from: string,
  to: string
): Promise<{ packages: number; amount: number }> {
  const supabase = await createClient()

  const [{ data: warehouse }, { data: shipments }] = await Promise.all([
    supabase
      .from('warehouses')
      .select('fee_per_package_flex, fee_per_package_agencia')
      .eq('id', warehouseId)
      .single<{ fee_per_package_flex: number; fee_per_package_agencia: number }>(),
    supabase
      .from('shipments')
      .select('fulfillment_type, delivered_at')
      .eq('warehouse_id', warehouseId)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', `${from}T00:00:00-05:00`)
      // El "to" es inclusivo para quien lee: "del 1 al 18" incluye el 18 entero.
      .lt('delivered_at', `${nextDay(to)}T00:00:00-05:00`)
      .returns<{ fulfillment_type: string | null; delivered_at: string }[]>(),
  ])

  if (!warehouse) return { packages: 0, amount: 0 }

  const fees = { feeFlex: warehouse.fee_per_package_flex, feeAgencia: warehouse.fee_per_package_agencia }
  const rows = shipments ?? []
  return {
    packages: rows.length,
    amount: rows.reduce((sum, s) => sum + feeFor(s.fulfillment_type, fees), 0),
  }
}

/** El día siguiente a una fecha YYYY-MM-DD, para poder tratar el rango como inclusivo. */
function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

async function buildLedger(
  supabase: Awaited<ReturnType<typeof createClient>>,
  w: WarehouseRow
): Promise<WarehouseLedger> {
  const [{ data: shipments }, { data: adjustments }, { data: payments }] = await Promise.all([
    supabase
      .from('shipments')
      .select('fulfillment_type')
      .eq('warehouse_id', w.id)
      .not('delivered_at', 'is', null)
      .returns<{ fulfillment_type: string | null }[]>(),
    supabase
      .from('warehouse_adjustments')
      .select('id, amount_delta, note, period_start')
      .eq('warehouse_id', w.id)
      .returns<{ id: string; amount_delta: number; note: string; period_start: string }[]>(),
    supabase
      .from('warehouse_payments')
      .select('id, amount, packages, period_start, period_end, note, paid_at')
      .eq('warehouse_id', w.id)
      .order('paid_at', { ascending: false })
      .returns<
        {
          id: string
          amount: number
          packages: number | null
          period_start: string | null
          period_end: string | null
          note: string | null
          paid_at: string
        }[]
      >(),
  ])

  const fees = { feeFlex: w.fee_per_package_flex, feeAgencia: w.fee_per_package_agencia }
  const rows = shipments ?? []
  const amountFromPackages = rows.reduce((sum, s) => sum + feeFor(s.fulfillment_type, fees), 0)
  const amountFromAdjustments = (adjustments ?? []).reduce((sum, a) => sum + Number(a.amount_delta), 0)
  const totalGenerated = amountFromPackages + amountFromAdjustments
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  return {
    warehouseId: w.id,
    warehouseName: w.name,
    feePerPackageFlex: w.fee_per_package_flex,
    feePerPackageAgencia: w.fee_per_package_agencia,
    packages: rows.length,
    amountFromPackages,
    amountFromAdjustments,
    totalGenerated,
    totalPaid,
    balance: totalGenerated - totalPaid,
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      paidAt: p.paid_at,
      amount: Number(p.amount),
      packages: p.packages,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      note: p.note,
    })),
    adjustments: (adjustments ?? []).map((a) => ({
      id: a.id,
      amount: Number(a.amount_delta),
      note: a.note,
      date: a.period_start,
    })),
  }
}

/**
 * Cuenta corriente de todas las bodegas que cobran. `is_fulfillment` queda
 * fuera: Full es de Mercado Libre, no despacha nadie a quien pagarle.
 */
export async function getAllWarehouseLedgers(): Promise<WarehouseLedger[]> {
  const supabase = await createClient()
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, fee_per_package_flex, fee_per_package_agencia')
    .eq('is_fulfillment', false)
    .order('name')
    .returns<WarehouseRow[]>()

  return Promise.all((warehouses ?? []).map((w) => buildLedger(supabase, w)))
}

/**
 * La cuenta de la bodega que está mirando la pantalla.
 *
 * Es el MISMO cálculo que ve la administradora — a propósito. Cuando la bodega
 * y el sistema mostraban números distintos hubo que reconciliar a mano tres
 * veces en agosto; que ambos lean la misma cuenta es lo que hace que una
 * diferencia se note el mismo día y no dos semanas después.
 *
 * Las políticas RLS de `warehouse_payments` y `warehouse_adjustments` ya
 * limitan cada bodega a lo suyo, así que no hace falta filtrar de nuevo acá.
 */
export async function getMyWarehouseLedger(): Promise<WarehouseLedger | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('warehouse_id')
    .eq('id', user.id)
    .single<{ warehouse_id: string | null }>()

  if (!profile?.warehouse_id) return null

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('id, name, fee_per_package_flex, fee_per_package_agencia')
    .eq('id', profile.warehouse_id)
    .single<WarehouseRow>()

  if (!warehouse) return null
  return buildLedger(supabase, warehouse)
}
