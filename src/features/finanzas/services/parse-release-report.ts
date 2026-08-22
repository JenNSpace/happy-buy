import type { MpMovementKind } from '@/types/database'

/**
 * Parser del Reporte de Liberaciones de Mercado Pago.
 *
 * Vive aparte de `sync-mp-movements.ts` (que es `server-only` y habla con la red)
 * para poder probarlo contra un CSV real sin levantar nada.
 */

/** Fila del CSV, ya partida. Las claves son los encabezados del reporte. */
type Row = Record<string, string>

/**
 * `DESCRIPTION` es la columna que dice qué pasó — NO `RECORD_TYPE`, que aparece
 * en `/columns` pero no existe en el CSV que se genera.
 */
const KIND_BY_DESCRIPTION: Record<string, MpMovementKind> = {
  payout: 'payout',
  payment: 'purchase',
  'fee-release_in_advance': 'advance_fee',
}

/**
 * ⚠️ La trampa de este reporte: cada movimiento viene DOS veces, una como
 * `reserve_for_X` y otra como `X`, con el mismo monto y el mismo `SOURCE_ID`.
 * Sumar todo da exactamente el doble. Solo cuentan las filas sin el prefijo.
 */
const isReserveRow = (description: string) => description.startsWith('reserve_for_')

function parseCsv(csv: string): Row[] {
  const lines = csv.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  // El reporte viene separado por `;`, no por coma.
  const header = lines[0].split(';').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]))
  })
}

const toNumber = (raw: string | undefined): number => {
  const n = Number.parseFloat(raw ?? '')
  return Number.isFinite(n) ? n : 0
}

export interface MpMovementRow {
  id: string
  moved_on: string
  kind: MpMovementKind
  amount: number
  payment_method: string | null
  raw_description: string
}

/** Convierte el CSV en las filas que guardamos. Exportada para poder probarla sin red. */
export function extractMovements(csv: string): MpMovementRow[] {
  const out: MpMovementRow[] = []

  for (const row of parseCsv(csv)) {
    const description = row.DESCRIPTION ?? ''
    if (isReserveRow(description)) continue

    const kind = KIND_BY_DESCRIPTION[description]
    if (!kind) continue

    // Solo lo que SALE. Un `payment` con crédito es una venta nuestra, no una compra.
    const amount = toNumber(row.NET_DEBIT_AMOUNT)
    if (amount <= 0) continue

    const id = row.SOURCE_ID
    if (!id) continue

    out.push({
      id,
      moved_on: (row.DATE ?? '').slice(0, 10),
      kind,
      amount,
      payment_method: row.PAYMENT_METHOD || null,
      raw_description: description,
    })
  }

  return out
}
