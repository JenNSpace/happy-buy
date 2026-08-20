import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_ACCOUNT = 'HAPPYBUYCOL'

/**
 * Current Mercado Libre access token, kept fresh by the "Happy Buy — ML Token
 * Refresh" n8n workflow (runs every 4h). Always read fresh — never cache the
 * token value itself, the refresh_token rotates on every use.
 */
async function getAccessToken(): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ml_tokens')
    .select('access_token')
    .eq('account', ML_ACCOUNT)
    .single()

  if (error || !data) {
    throw new Error(`No se pudo leer el token de Mercado Libre: ${error?.message ?? 'sin datos'}`)
  }

  return data.access_token
}

/**
 * Mercado Libre responde 429 `local_rate_limited` cuando se le piden demasiadas
 * cosas seguidas. Pasó de verdad el 2026-08-20: la pantalla de logística se
 * auto-refresca cada minuto y con dos personas mirándola tumbó la página entera.
 *
 * La causa de fondo (pedir el detalle de un mes de órdenes en cada carga) se
 * arregló en `getPendingShipmentsForAdmin`; esto es la red de seguridad, porque
 * el límite es de ML y no depende solo de nosotros. Espera y reintenta: un
 * segundo de demora es mejor que una pantalla en blanco.
 */
const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_BASE_DELAY_MS = 400

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function mlGet<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  const token = await getAccessToken()

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
      },
      // Ads endpoint is slow (~25-30s); orders/items are fast. Cache at the page level instead.
      cache: 'no-store',
    })

    if (res.ok) return res.json() as Promise<T>

    // Espera creciente y reintenta; cualquier otro error falla de una, que es
    // lo correcto: un 404 no mejora esperando.
    if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
      await sleep(RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt)
      continue
    }

    const body = await res.text()
    throw new Error(`ML API ${path} -> ${res.status}: ${body}`)
  }
}

/**
 * Same call, against Mercado Pago's host instead of Mercado Libre's.
 *
 * The token above works here untouched — no extra scopes, no second app. This
 * matters because the identical paths on api.mercadolibre.com answer 403/404,
 * which reads exactly like a missing permission and sent us looking for one
 * (2026-08-18). It was the host all along.
 *
 * What it unlocks that ML's own API does not expose: `money_release_date` (when
 * the money actually lands), `transaction_details.net_received_amount` (what is
 * really left of a sale) and `charges_details[]` (the exact fee breakdown,
 * including the ICA Bogotá withholding nobody was counting).
 */
export async function mpGet<T>(path: string): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Mercado Pago API ${path} -> ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

export async function mlGetBinary(path: string): Promise<ArrayBuffer> {
  const token = await getAccessToken()

  const res = await fetch(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ML API ${path} -> ${res.status}: ${body}`)
  }

  return res.arrayBuffer()
}
