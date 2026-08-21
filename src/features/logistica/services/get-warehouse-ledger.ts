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
  /**
   * Hasta qué día llega el último pago. Todo lo despachado después está
   * pendiente y sin ninguna duda.
   *
   * Sin esto el "N paquetes despachados" de la tarjeta no decía nada útil: era
   * el total del período, ya pagado en parte, así que el número no correspondía
   * al saldo. La usuaria lo señaló el 2026-08-20 — a Daniel le cuadraba por
   * casualidad y a Gina no.
   */
  coveredThrough: string | null
  /** Paquetes despachados después del último pago: los que sí se deben. */
  pendingPackages: number
  pendingAmount: number
  /** Etiquetas y extras posteriores al último pago, ya netos de lo saldado. */
  pendingAdjustments: number
  /**
   * Los conceptos pendientes UNO POR UNO, no un total opaco.
   *
   * Un número agregado no se puede verificar: la usuaria vio "Otros conceptos
   * $20.000" y no tenía forma de saber qué había adentro (2026-08-21). Cada
   * línea de plata tiene que poder rastrearse hasta su origen.
   */
  pendingAdjustmentItems: LedgerAdjustment[]
  /** Pagos de un concepto suelto dentro del período pendiente — se restan arriba. */
  settledConcepts: { id: string; paidAt: string; amount: number }[]
  /**
   * Lo que quedó debiéndose de un período YA cobrado — cuando el pago fue menor
   * que lo generado en ese rango. A Gina le pasó: cobró $78.000 cuando había
   * generado $84.800, porque su cuenta se quedó corta en dos envíos.
   */
  shortfall: number
  payments: LedgerPayment[]
  adjustments: LedgerAdjustment[]
}

/**
 * Desde cuándo la cuenta del sistema es la fuente. Vive en
 * `warehouses.ledger_start` porque **no es la misma fecha para las dos bodegas**.
 *
 * Gina hace Flex, y solo ella hace Flex: un envío Flex es suyo con certeza
 * aunque se haya asignado después, así que todo agosto sirve. Daniel hace
 * agencia, y Gina también hace agencia de vez en cuando: los 18 envíos de
 * agencia que se le cargaron por SQL el 18-ago son una suposición, y esa
 * deducción ya falló con seis envíos. Su período anterior se salda con la
 * cuenta de cobro que él pasó, registrada como ajuste de apertura.
 *
 * La usuaria lo zanjó el 2026-08-20: *"no quiero que especules... di que no
 * sabes a qué paquetes corresponde y ya de ahí en adelante sí que sea lo real"*
 * y *"daniel y gina son diferentes, tenemos todo agosto de gina"*.
 */

/**
 * Solo cuenta lo que quedó REGISTRADO al despachar.
 *
 * Antes de que la app llevara la cuenta, la bodega de cada envío se dedujo por
 * el canal ("si es agencia es de Daniel, si es Flex es de Gina") y se cargó por
 * SQL el 2026-08-18. Eso no es saber quién despachó: es una suposición, y la
 * regla ya había fallado con seis envíos. Contarlos como paquetes cobrables es
 * inventar plata.
 *
 * La usuaria lo zanjó el 2026-08-20: *"no quiero que especules... di que no
 * sabes a qué paquetes corresponde y ya de ahí en adelante sí que sea lo real"*.
 * El período anterior se salda con la cuenta de cobro de la propia bodega,
 * registrada como un ajuste de apertura.
 *
 * Se distingue por los datos, no por una fecha elegida a dedo: una fila creada
 * mucho después del despacho no la escribió nadie viendo salir el paquete
 * (ver `wasRecordedOnDispatch`).
 */


/** Desde cuándo existe el sistema de pagos. Aplica a ajustes y pagos, que son entradas manuales. */
const SYSTEM_START = '2026-08-01'

interface WarehouseRow {
  id: string
  name: string
  fee_per_package_flex: number
  fee_per_package_agencia: number
  ledger_start: string
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
      .select('fulfillment_type, delivered_at, created_at')
      .eq('warehouse_id', warehouseId)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', `${from}T00:00:00-05:00`)
      // El "to" es inclusivo para quien lee: "del 1 al 18" incluye el 18 entero.
      .lt('delivered_at', `${nextDay(to)}T00:00:00-05:00`)
      .returns<{ fulfillment_type: string | null; delivered_at: string; created_at: string }[]>(),
  ])

  if (!warehouse) return { packages: 0, amount: 0 }

  const fees = { feeFlex: warehouse.fee_per_package_flex, feeAgencia: warehouse.fee_per_package_agencia }
  const rows = (shipments ?? []).filter(isAttributionCertain)
  return {
    packages: rows.length,
    amount: rows.reduce((sum, s) => sum + feeFor(s.fulfillment_type, fees), 0),
  }
}

/** El día calendario de un instante, en Bogotá, como YYYY-MM-DD. */
function bogotaDay(instant: string): string {
  return new Date(instant).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

/** Dos horas de tolerancia entre el despacho y la fila: más que eso es una corrección posterior. */
export function wasRecordedOnDispatch(s: { created_at: string; delivered_at: string }): boolean {
  return new Date(s.created_at).getTime() <= new Date(s.delivered_at).getTime() + 2 * 60 * 60 * 1000
}

/**
 * ¿Sabemos de verdad qué bodega despachó esto?
 *
 * Sí en dos casos: quedó registrado al despachar, **o** es Flex — solo Gina hace
 * Flex, regla firme del negocio, así que ahí no hay ambigüedad ni cuando la fila
 * se creó después.
 *
 * No cuando es agencia asignada después: ese caso pudo ser de cualquiera de las
 * dos, y ya se equivocó una vez con seis envíos.
 */
export function isAttributionCertain(s: {
  created_at: string
  delivered_at: string
  fulfillment_type: string | null
}): boolean {
  return s.fulfillment_type === 'flex' || wasRecordedOnDispatch(s)
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
      .select('fulfillment_type, delivered_at, created_at')
      .eq('warehouse_id', w.id)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', `${w.ledger_start}T00:00:00-05:00`)
      .returns<{ fulfillment_type: string | null; delivered_at: string; created_at: string }[]>(),
    supabase
      .from('warehouse_adjustments')
      .select('id, amount_delta, note, period_start')
      .eq('warehouse_id', w.id)
      // Los ajustes NO se filtran por `ledger_start`: ese corte existe porque la
      // atribución de los ENVÍOS anteriores no es confiable, y un ajuste es una
      // entrada manual, siempre confiable. Filtrarlos por ahí dejaba la apertura
      // de Daniel fuera del período que salda, y aparecía como pendiente.
      .gte('period_start', SYSTEM_START)
      .returns<{ id: string; amount_delta: number; note: string; period_start: string }[]>(),
    supabase
      .from('warehouse_payments')
      .select('id, amount, packages, period_start, period_end, note, paid_at')
      .eq('warehouse_id', w.id)
      .gte('paid_at', `${SYSTEM_START}T00:00:00-05:00`)
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
  // Solo lo que sabemos de verdad de quién fue — ver `isAttributionCertain`.
  const rows = (shipments ?? []).filter(isAttributionCertain)
  const amountFromPackages = rows.reduce((sum, s) => sum + feeFor(s.fulfillment_type, fees), 0)
  const amountFromAdjustments = (adjustments ?? []).reduce((sum, a) => sum + Number(a.amount_delta), 0)
  const totalGenerated = amountFromPackages + amountFromAdjustments
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = totalGenerated - totalPaid

  /**
   * Hasta dónde llega lo ya cobrado. Lo despachado después es pendiente puro.
   *
   * **Solo cuentan los pagos que cubren un período** (más de un día). Un pago de
   * un concepto suelto se registra en un solo día y NO mueve la cobertura: si lo
   * hiciera, pagar $10.000 de etiquetas un día 20 haría ver como saldados todos
   * los paquetes hasta esa fecha. Pasó de verdad el 2026-08-21.
   */
  const coveredThrough =
    (payments ?? []).reduce<string | null>((max, p) => {
      if (!p.period_start || !p.period_end) return max
      if (p.period_start === p.period_end) return max
      return !max || p.period_end > max ? p.period_end : max
    }, null) ?? null

  const esPosterior = (fecha: string) =>
    !coveredThrough || fecha.slice(0, 10) > coveredThrough

  const pendientes = coveredThrough
    ? rows.filter((s) => bogotaDay(s.delivered_at) > coveredThrough)
    : rows
  const pendingAmount = pendientes.reduce((sum, s) => sum + feeFor(s.fulfillment_type, fees), 0)
  /**
   * Los conceptos sueltos que faltan por pagar.
   *
   * A los ajustes posteriores al período cobrado se les restan los pagos de un
   * solo día que caen ahí: esos saldan un concepto, no un período. Sin esto,
   * Enrique pagaba $10.000 de etiquetas y la tarjeta seguía cobrándolos, porque
   * el ajuste contaba como pendiente y el pago solo bajaba el total.
   */
  const settledConcepts = (payments ?? [])
    .filter((p) => p.period_start && p.period_start === p.period_end && esPosterior(p.period_start))
    .map((p) => ({ id: p.id, paidAt: p.paid_at, amount: Number(p.amount) }))
  const conceptosPagados = settledConcepts.reduce((sum, p) => sum + p.amount, 0)

  const pendingAdjustmentItems = (adjustments ?? [])
    .filter((a) => esPosterior(a.period_start))
    .map((a) => ({ id: a.id, amount: Number(a.amount_delta), note: a.note, date: a.period_start }))

  const pendingAdjustments =
    pendingAdjustmentItems.reduce((sum, a) => sum + a.amount, 0) - conceptosPagados

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
    balance,
    coveredThrough,
    pendingPackages: pendientes.length,
    pendingAmount,
    pendingAdjustments,
    pendingAdjustmentItems,
    settledConcepts,
    // Por diferencia, para que las tres partes SIEMPRE sumen el saldo aunque
    // haya varios pagos con rangos que se solapen.
    shortfall: balance - pendingAmount - pendingAdjustments,
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
    .select('id, name, fee_per_package_flex, fee_per_package_agencia, ledger_start')
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
    .select('id, name, fee_per_package_flex, fee_per_package_agencia, ledger_start')
    .eq('id', profile.warehouse_id)
    .single<WarehouseRow>()

  if (!warehouse) return null
  return buildLedger(supabase, warehouse)
}
