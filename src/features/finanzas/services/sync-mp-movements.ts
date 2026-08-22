import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { mpGet, mpPost, mpGetText } from '@/features/dashboard/services/ml-client'
import { extractMovements, type MpMovementRow } from './parse-release-report'

/**
 * Trae del Reporte de Liberaciones de Mercado Pago todo lo que SALIÓ de la cuenta.
 *
 * Por qué este reporte y no `/v1/payments/search`: ahí solo aparecen las compras
 * hechas dentro de Mercado Libre. Los retiros al banco — que es la mayor parte de
 * la plata que sale — únicamente existen acá, como filas `payout`. Verificado el
 * 2026-08-21: 11 retiros por $5.393.900 en 30 días que no se veían por ningún
 * otro endpoint.
 */

const REPORT_PATH = '/v1/account/release_report'

/** Cuántos días pide cada reporte nuevo. Holgado a propósito: ver DELAY abajo. */
const WINDOW_DAYS = 30

interface ReportFile {
  file_name: string
  date_created: string
  status: string
}

/**
 * Un ciclo de sincronización.
 *
 * Es en dos tiempos a propósito: generar un reporte tarda ~2 minutos y es
 * asíncrono, demasiado para una petición web. Así que cada corrida ingiere el
 * reporte que pidió la corrida anterior y deja pedido el siguiente.
 *
 * DELAY: el reporte tampoco es tiempo real — pedido el 21 de agosto trajo datos
 * hasta el 19. Un retiro de hoy aparece en un par de días, y no hay forma de
 * acelerarlo: no existe endpoint de movimientos ni de saldo (ambos 403/404).
 */
export async function syncMpMovements(): Promise<{
  ingested: number
  fileName: string | null
  requested: boolean
}> {
  const files = await mpGet<ReportFile[]>(`${REPORT_PATH}/list`)

  const newest = [...(files ?? [])]
    .filter((f) => f.status === 'enabled')
    .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())[0]

  let ingested = 0

  if (newest) {
    const csv = await mpGetText(`${REPORT_PATH}/${newest.file_name}`)
    const movements = extractMovements(csv)

    if (movements.length > 0) {
      const supabase = createAdminClient()
      // Upsert por SOURCE_ID: reingerir el mismo archivo no duplica nada, que es
      // lo que permite no llevar registro de qué archivos ya se procesaron.
      const { error } = await supabase.from('mp_movements').upsert(movements, { onConflict: 'id' })
      if (error) throw new Error(`No se pudieron guardar los movimientos: ${error.message}`)
      ingested = movements.length
    }
  }

  const end = new Date()
  const begin = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`

  await mpPost(REPORT_PATH, { begin_date: iso(begin), end_date: iso(end) })

  return { ingested, fileName: newest?.file_name ?? null, requested: true }
}
