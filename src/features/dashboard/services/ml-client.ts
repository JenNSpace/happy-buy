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
const RATE_LIMIT_RETRIES = 4
const RATE_LIMIT_BASE_DELAY_MS = 1000

/**
 * Cuántos segundos puede reusarse una respuesta de ML.
 *
 * La pantalla de logística se auto-refresca sola, y encima se recarga a mano,
 * se abre en varias pestañas y reintenta cuando falla. Sin esto, cada una de
 * esas cargas era una tanda nueva de llamadas y ML terminaba respondiendo 429
 * `local_rate_limited` (pasó dos veces el 2026-08-20).
 *
 * 20 segundos es el punto medio: corta las ráfagas sin volver la pantalla
 * mentirosa. El riesgo real de datos viejos es que un paquete que la bodega ya
 * despachó siga apareciendo y alguien lo mande dos veces — por eso no más.
 */
const ML_CACHE_SECONDS = 20

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function mlGet<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  const token = await getAccessToken()

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
      },
      // `force-cache` es obligatorio, no decorativo: la doc de Next 16 dice que
      // el cacheo es opt-in y que una petición con header `Authorization` —como
      // todas las nuestras— solo se cachea si se pide explícitamente. Con
      // `revalidate` a secas no se guardaba nada y el 429 volvía igual.
      cache: 'force-cache',
      next: { revalidate: ML_CACHE_SECONDS },
    })

    if (res.ok) return res.json() as Promise<T>

    // Espera creciente (1s, 2s, 4s, 8s) y reintenta. La ventana del límite de
    // ML dura más que unos milisegundos: con esperas cortas se agotaban los
    // reintentos y la pantalla se caía igual.
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

/**
 * POST contra Mercado Pago. Lo usa el Reporte de Liberaciones, que es el unico
 * sitio donde se ven los retiros al banco (`/v1/payments/search` solo muestra
 * las compras hechas dentro de Mercado Libre).
 */
export async function mpPost<T>(path: string, payload: unknown): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Mercado Pago API POST ${path} -> ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

/** Igual que mpGet pero devuelve el cuerpo crudo — los reportes bajan en CSV. */
export async function mpGetText(path: string): Promise<string> {
  const token = await getAccessToken()

  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Mercado Pago API ${path} -> ${res.status}: ${body}`)
  }

  return res.text()
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
