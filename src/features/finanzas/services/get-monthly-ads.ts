import 'server-only'
import { mlGet } from '@/features/dashboard/services/ml-client'

interface BillingRow {
  charge_info?: {
    creation_date_time?: string
    detail_amount?: number
    detail_type?: string
    detail_sub_type?: string
  }
}

interface BillingResponse {
  total?: number
  results?: BillingRow[]
}

const PAGE = 100

/**
 * Gasto real en publicidad por mes CALENDARIO.
 *
 * Sale del libro de cargos de ML (`billing`), no de `ads_daily_snapshots`: ese
 * cron arrancó hace días y no tiene historia, mientras que el libro cubre el año
 * entero.
 *
 * Dos cosas que hay que respetar de esta API:
 *
 * 1. **Los periodos de facturación NO son meses.** La clave `2026-08-01` trae
 *    cargos desde el 26 de julio. Por eso se agrupa por `creation_date_time` de
 *    cada línea y se piden periodos de más, en vez de confiar en la clave.
 *
 * 2. **Solo `PADS` es gasto nuevo.** La factura también trae `CV` (comisión) y
 *    `CXD` (envíos), pero esos ML ya los descontó de cada pago —verificado
 *    2026-08-18: el pago de factura de julio fue $175.524, idéntico al PADS del
 *    mes— así que sumarlos aquí contaría la comisión dos veces.
 */
export async function getMonthlyAds(months: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>(months.map((m) => [m, 0]))
  if (months.length === 0) return result

  // Un periodo extra a cada lado, porque los cargos de un mes caen repartidos
  // entre dos periodos de facturación.
  const keys = new Set<string>()
  for (const m of months) {
    const [y, mo] = m.split('-').map(Number)
    for (const delta of [0, 1]) {
      const d = new Date(Date.UTC(y, mo - 1 + delta, 1))
      keys.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`)
    }
  }

  await Promise.all(
    [...keys].map(async (key) => {
      let offset = 0
      while (true) {
        let page: BillingResponse
        try {
          page = await mlGet<BillingResponse>(
            `/billing/integration/periods/key/${key}/group/ML/details?document_type=BILL&limit=${PAGE}&offset=${offset}`,
            { 'x-format-new': 'true' }
          )
        } catch {
          // Un periodo que ML no devuelve no puede tumbar el P&L entero.
          return
        }

        for (const row of page.results ?? []) {
          const info = row.charge_info
          if (info?.detail_sub_type !== 'PADS' || !info.creation_date_time) continue

          const month = info.creation_date_time.slice(0, 7)
          if (!result.has(month)) continue

          const sign = info.detail_type === 'CHARGE' ? 1 : -1
          result.set(month, (result.get(month) ?? 0) + sign * (info.detail_amount ?? 0))
        }

        offset += PAGE
        if (offset >= (page.total ?? 0)) break
      }
    })
  )

  return result
}
