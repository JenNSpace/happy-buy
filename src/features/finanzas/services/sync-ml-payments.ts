import 'server-only'
import { mpGet } from '@/features/dashboard/services/ml-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePayment, type MpPayment } from './parse-payment'

interface MpSearchResponse {
  paging: { total: number; offset: number; limit: number }
  results: MpPayment[]
}

const PAGE_SIZE = 50

/**
 * Cuántas páginas mirar hacia atrás buscando pagos nuevos antes de rendirse.
 * Con ~5 pagos al día, 4 páginas cubren más de dos semanas — de sobra para un
 * sync que corre al abrir la tab. La carga histórica completa no pasa por acá:
 * es `scripts/import-ml-payments.mjs`, que se corre a mano una sola vez.
 */
const MAX_PAGES_INCREMENTAL = 4

function searchPath(offset: number): string {
  const query = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    limit: String(PAGE_SIZE),
    offset: String(offset),
  })
  return `/v1/payments/search?${query.toString()}`
}

export interface SyncResult {
  nuevos: number
  actualizados: number
}

/**
 * Trae los pagos de Mercado Pago y refresca los que estaban pendientes.
 *
 * Son dos trabajos distintos y ambos hacen falta:
 *
 * 1. **Pagos nuevos** — pagina de más reciente a más viejo y corta apenas topa
 *    con una página entera de ids ya conocidos. Sin ese corte estaríamos
 *    recorriendo 1.441 pagos en cada carga de la pantalla.
 *
 * 2. **Pendientes que ya vencieron** — un pago no avisa cuando se libera: pasa
 *    de `pending` a `released` solo, en la fecha que él mismo anunció. Si nadie
 *    vuelve a mirarlo, el dinero se queda "retenido" para siempre en nuestra
 *    tabla aunque ya esté en la cuenta.
 *
 * Es idempotente: `upsert` por `id`, mismo patrón que `syncDispatchedShipments`.
 * Correrlo dos veces seguidas no duplica ni altera totales.
 */
export async function syncMlPayments(): Promise<SyncResult> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('ml_payments').select('id')
  const knownIds = new Set((existing ?? []).map((p) => Number(p.id)))

  const fresh: MpPayment[] = []

  for (let page = 0; page < MAX_PAGES_INCREMENTAL; page++) {
    const data = await mpGet<MpSearchResponse>(searchPath(page * PAGE_SIZE))
    const results = data.results ?? []
    if (results.length === 0) break

    const nuevosEnPagina = results.filter((p) => !knownIds.has(p.id))
    fresh.push(...nuevosEnPagina)

    // Página completa de conocidos: de acá para atrás ya está todo sincronizado.
    if (nuevosEnPagina.length === 0) break
    if ((page + 1) * PAGE_SIZE >= data.paging.total) break
  }

  let nuevos = 0
  if (fresh.length > 0) {
    const rows = fresh.map(parsePayment)
    const { error } = await supabase.from('ml_payments').upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`No se pudieron guardar los pagos nuevos: ${error.message}`)
    nuevos = rows.length
  }

  const actualizados = await refreshMaturedPending(knownIds)

  return { nuevos, actualizados }
}

/**
 * Vuelve a pedir los pagos que seguían `pending` pero cuya fecha de liberación
 * ya pasó. Solo esos: pedir todos los pendientes en cada sync sería gastar
 * llamadas en pagos que sabemos que no se movieron todavía.
 */
async function refreshMaturedPending(knownIds: Set<number>): Promise<number> {
  const supabase = createAdminClient()

  const { data: matured } = await supabase
    .from('ml_payments')
    .select('id')
    .eq('money_release_status', 'pending')
    .lte('money_release_date', new Date().toISOString())

  const ids = (matured ?? []).map((p) => Number(p.id)).filter((id) => knownIds.has(id))
  if (ids.length === 0) return 0

  const refreshed = await Promise.all(
    ids.map(async (id) => {
      try {
        return await mpGet<MpPayment>(`/v1/payments/${id}`)
      } catch {
        // Un pago que no responde no debe tumbar el sync entero: el resto se
        // guarda igual y este se reintenta en la próxima corrida.
        return null
      }
    })
  )

  const rows = refreshed.filter((p): p is MpPayment => p !== null).map(parsePayment)
  if (rows.length === 0) return 0

  const { error } = await supabase.from('ml_payments').upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`No se pudieron actualizar los pagos liberados: ${error.message}`)

  return rows.length
}
