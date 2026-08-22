import { formatCOP } from '@/shared/utils/format'
import type { CashSummary } from '../services/get-cash-summary'
import { SURFACE_CARD, EYEBROW } from '@/shared/ui/surface'

const ventas = (n: number) => `${n} ${n === 1 ? 'venta' : 'ventas'}`
const depositos = (n: number) => `${n} ${n === 1 ? 'depósito' : 'depósitos'}`

/**
 * Una de las tres cifras del encabezado.
 *
 * `tone` sigue la convención del dashboard: verde solo para plata que ENTRA.
 * Una deuda de tarjeta es operación normal, no una emergencia, así que va en
 * gris — el rojo se reserva para un estado genuinamente malo (cupo excedido,
 * semana en pérdida) y pierde fuerza si se usa para lo rutinario.
 */
function Figure({
  label,
  value,
  hint,
  tone = 'neutral',
  size = 'md',
}: {
  label: string
  value: number
  hint: string
  tone?: 'in' | 'neutral'
  size?: 'lg' | 'md'
}) {
  return (
    <div>
      <p className={EYEBROW}>{label}</p>
      <p
        className={`mt-1 font-bold tracking-tight tabular-nums ${
          size === 'lg' ? 'text-4xl' : 'text-2xl'
        } ${tone === 'in' ? 'text-happy-greenDark' : 'text-gray-900'}`}
      >
        {formatCOP(value)}
      </p>
      <p className="mt-1 text-sm text-gray-500">{hint}</p>
    </div>
  )
}

export function CashSummaryCard({ summary }: { summary: CashSummary }) {
  // Sin pagos sincronizados mostrar $0 sería mentir: se leería como "no tienes
  // plata" cuando lo cierto es que todavía no sabemos.
  if (summary.sinDatos) {
    return (
      <div className={`${SURFACE_CARD} p-6`}>
        <h2 className="text-lg font-semibold text-gray-900">Tu plata hoy</h2>
        <p className="mt-4 text-sm text-gray-500">
          Sincronizando los pagos de Mercado Libre… Actualiza la página en unos segundos.
        </p>
      </div>
    )
  }

  return (
    <div className={`${SURFACE_CARD} p-6`}>
      <h2 className="text-lg font-semibold text-gray-900">Tu plata hoy</h2>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Figure
          label="Retenido en ML"
          value={summary.retenido}
          hint={`de ${ventas(summary.retenidoCount)}`}
          tone="in"
          size="lg"
        />
        <Figure
          label="Entra esta semana"
          value={summary.entraEstaSemana}
          hint={
            summary.entraEstaSemanaCount > 0
              ? depositos(summary.entraEstaSemanaCount)
              : 'nada se libera antes del domingo'
          }
          tone="in"
        />
        <Figure
          label="Debes"
          value={summary.debes}
          hint={summary.debes > 0 ? (summary.debesPrincipal ?? 'compras sin pagar') : 'todo al día'}
        />
      </div>

      {summary.atrasado > 0 && <AtrasadoNotice summary={summary} />}
    </div>
  )
}

/**
 * Plata cuya fecha de liberación pasó y ML sigue reportando como pendiente.
 *
 * Ámbar, no rojo: no se sabe si es un problema (un reclamo abierto) o solo un
 * caso viejo sin cerrar, y pintar de rojo algo que quizá esté bien es la forma
 * de que los rojos dejen de mirarse. Tampoco se inventa la causa — solo se
 * señala el hecho y se la manda a la fuente.
 */
function AtrasadoNotice({ summary }: { summary: CashSummary }) {
  const desde = summary.atrasadoDesde
    ? new Date(summary.atrasadoDesde).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Bogota',
      })
    : null

  return (
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-gray-900">
        {formatCOP(summary.atrasado)} llevan más tiempo del normal sin liberarse
      </p>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">
        {summary.atrasadoCount === 1 ? 'Una venta pasó' : `${summary.atrasadoCount} ventas pasaron`} su
        fecha de liberación y Mercado Libre las sigue marcando como pendientes
        {desde && <> — la más antigua desde el {desde}</>}. Puede ser un reclamo o una devolución en
        proceso; se revisa en Mercado Pago.
      </p>
    </div>
  )
}
