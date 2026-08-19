/**
 * Carga histórica de los pagos de Mercado Pago a la tabla `ml_payments`.
 *
 * Se corre A MANO y UNA SOLA VEZ:
 *   node scripts/import-ml-payments.mjs
 *
 * Existe aparte del sync de la app a propósito: son ~1.400 pagos y unas 30
 * llamadas a la API. Hacer eso al abrir una pantalla sería inaceptable.
 * El sync de la app (src/features/finanzas/services/sync-ml-payments.ts) solo
 * mira las páginas más recientes.
 *
 * Es idempotente — hace upsert por id, así que volver a correrlo no duplica
 * nada. Si se corta a la mitad, se relanza y sigue.
 */
import { readFileSync } from 'node:fs'

const PAGE_SIZE = 50

function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8')
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
      })
  )
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

async function getMlToken() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ml_tokens?account=eq.HAPPYBUYCOL&select=access_token`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const rows = await res.json()
  if (!rows?.[0]?.access_token) throw new Error('No se pudo leer el token de Mercado Libre')
  return rows[0].access_token
}

/**
 * Mismo reparto de cargos que `src/features/finanzas/services/parse-payment.ts`.
 * Está duplicado a propósito: este script corre en Node plano, sin el pipeline
 * de TypeScript. Si cambia la clasificación allá, cambiarla acá también.
 */
function breakdownCharges(charges) {
  const out = { meliFee: 0, shippingCharge: 0, taxWithholding: 0, other: 0 }
  for (const charge of charges ?? []) {
    if (charge.accounts?.from !== 'collector') continue
    const amount = (charge.amounts?.original ?? 0) - (charge.amounts?.refunded ?? 0)
    const name = charge.name ?? ''
    if (name === 'meli_fee') out.meliFee += amount
    else if (name.startsWith('shp_')) out.shippingCharge += amount
    else if (name.startsWith('tax_withholding')) out.taxWithholding += amount
    else out.other += amount
  }
  return out
}

function parsePayment(payment) {
  const b = breakdownCharges(payment.charges_details)
  const total = b.meliFee + b.shippingCharge + b.taxWithholding + b.other
  const net = payment.transaction_details?.net_received_amount ?? payment.transaction_amount - total
  const releaseStatus = payment.money_release_status
  const knownStatus = releaseStatus === 'pending' || releaseStatus === 'released'

  // Quien cobra. Si no es Happy Buy, el pago es una COMPRA de Jen: la API
  // devuelve lo que cobra y lo que paga en la misma lista.
  const collector = payment.collector_id ?? payment.collector?.id ?? null

  return {
    id: payment.id,
    order_id: payment.order?.id != null ? String(payment.order.id) : null,
    collector_id: collector != null ? Number(collector) : null,
    operation_type: payment.operation_type,
    description: payment.description ?? null,
    status: payment.status,
    date_approved: payment.date_approved ?? null,
    money_release_date: payment.money_release_date ?? null,
    money_release_status: knownStatus ? releaseStatus : null,
    transaction_amount: payment.transaction_amount,
    net_received_amount: net,
    meli_fee: b.meliFee,
    shipping_charge: b.shippingCharge,
    tax_withholding: b.taxWithholding,
    charges: payment.charges_details ?? null,
    synced_at: new Date().toISOString(),
  }
}

async function upsertBatch(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ml_payments?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`Supabase rechazó el lote: ${res.status} ${await res.text()}`)
}

async function main() {
  const token = await getMlToken()
  const mp = async (path) => {
    const res = await fetch(`https://api.mercadopago.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Mercado Pago ${path} -> ${res.status}: ${await res.text()}`)
    return res.json()
  }

  const first = await mp(`/v1/payments/search?sort=date_created&criteria=desc&limit=1`)
  const total = first.paging?.total ?? 0
  console.log(`Pagos en la cuenta: ${total}`)

  let importados = 0
  let sinClasificar = 0

  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const page = await mp(
      `/v1/payments/search?sort=date_created&criteria=desc&limit=${PAGE_SIZE}&offset=${offset}`
    )
    const results = page.results ?? []
    if (results.length === 0) break

    const rows = results.map(parsePayment)
    sinClasificar += results.filter((p) => breakdownCharges(p.charges_details).other > 0).length

    await upsertBatch(rows)
    importados += rows.length
    console.log(`  ${importados}/${total}`)
  }

  console.log(`\nListo: ${importados} pagos importados.`)
  if (sinClasificar > 0) {
    console.log(
      `Atención: ${sinClasificar} pagos traen algún cargo que no supimos clasificar. ` +
        `Suman al total igual, pero conviene revisarlos:\n` +
        `  select id, charges from ml_payments where meli_fee + shipping_charge + tax_withholding ` +
        `<> transaction_amount - net_received_amount;`
    )
  }
}

main().catch((err) => {
  console.error('\nFalló la importación:', err.message)
  process.exit(1)
})
