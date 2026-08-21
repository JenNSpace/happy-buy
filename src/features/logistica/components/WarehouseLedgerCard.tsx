'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/shared/utils/format'
import { previewRange, registerPayment, deletePayment, loadStatement } from '../services/ledger-actions'
import { addAdjustment, removeAdjustment } from '../services/payment-actions'
import type { WarehouseLedger } from '../services/get-warehouse-ledger'
import type { BillingStatement } from '../services/get-billing-statement'

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

/** El día siguiente a un YYYY-MM-DD — para decir "desde el 19" cuando el pago llegó al 18. */
function siguienteDia(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** Hoy en Bogotá como YYYY-MM-DD, para los campos de fecha. */
function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function primerDiaDelMes(): string {
  return `${hoyBogota().slice(0, 7)}-01`
}

/**
 * Formulario de pago con verificación previa.
 *
 * El punto está en el bloque de comparación: antes de guardar muestra qué
 * generó la bodega en ese mismo rango y la diferencia. Es lo que habría cazado
 * en el momento los $6.800 que faltaron el 2026-08-18, en vez de días después.
 */
function PaymentForm({ ledger, onDone }: { ledger: WarehouseLedger; onDone: () => void }) {
  const router = useRouter()
  const [from, setFrom] = useState(primerDiaDelMes())
  const [to, setTo] = useState(hoyBogota())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [generated, setGenerated] = useState<{ packages: number; amount: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verificar() {
    setChecking(true)
    setError(null)
    const result = await previewRange(ledger.warehouseId, from, to)
    setChecking(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setGenerated({ packages: result.packages, amount: result.amount })
  }

  const monto = Number(amount || 0)
  const diferencia = generated ? monto - generated.amount : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await registerPayment({
      warehouseId: ledger.warehouseId,
      amount: monto,
      from,
      to,
      packages: generated?.packages,
      note,
    })

    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-gray-500">La cuenta cubre desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setGenerated(null)
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setGenerated(null)
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={verificar}
        disabled={checking}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {checking ? 'Revisando...' : 'Ver qué generó en ese rango'}
      </button>

      {generated && (
        <div className="rounded-md border border-gray-200 bg-white p-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>
              {generated.packages} paquete{generated.packages === 1 ? '' : 's'} despachado
              {generated.packages === 1 ? '' : 's'}
            </span>
            <span className="font-semibold text-gray-900">{formatCOP(generated.amount)}</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            No incluye etiquetas ni extras — esos van como ajuste y se suman al saldo.
          </p>
        </div>
      )}

      <div>
        <label className="text-[11px] text-gray-500">Cuánto se pagó</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
        />
      </div>

      {/* La comparación es el punto de todo el formulario: aquí se ve la
          diferencia ANTES de guardar, no días después. */}
      {generated && monto > 0 && diferencia !== 0 && (
        <div
          className={`rounded-md p-2 text-xs ${
            diferencia < 0 ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'
          }`}
        >
          {diferencia < 0 ? (
            <>
              <span className="font-semibold">Se está pagando {formatCOP(-diferencia)} menos</span> de lo que
              generó por paquetes en ese rango. Puede estar bien si hay algo pendiente de acordar, pero vale
              revisar la cuenta antes de guardar.
            </>
          ) : (
            <>
              <span className="font-semibold">Se está pagando {formatCOP(diferencia)} más</span> de lo que generó
              por paquetes. Normal si incluye etiquetas y extras.
            </>
          )}
        </div>
      )}

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota. Ej: Enrique pagó contra la cuenta de cobro de Gina"
        className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || monto <= 0}
          className="flex-1 rounded-md bg-happy-green px-3 py-2 text-sm font-medium text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Registrar pago'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** La cuenta de cobro que el sistema arma para mandársela a la bodega. */
function StatementPanel({ ledger, onClose }: { ledger: WarehouseLedger; onClose: () => void }) {
  // El canal solo importa si cambia la tarifa. Donde las dos son iguales la
  // columna repetía "Agencia" en cada fila sin decir nada.
  const muestraCanal = ledger.feePerPackageFlex !== ledger.feePerPackageAgencia
  // Arranca en el período que está sin pagar: la pregunta que trae a alguien
  // acá es "¿cuáles paquetes son los que debo?".
  const [from, setFrom] = useState(
    ledger.coveredThrough ? siguienteDia(ledger.coveredThrough) : primerDiaDelMes()
  )
  const [to, setTo] = useState(hoyBogota())
  const [statement, setStatement] = useState<BillingStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generar() {
    setLoading(true)
    setError(null)
    const result = await loadStatement(ledger.warehouseId, from, to)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setStatement(result.statement)
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-gray-500">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={generar}
          disabled={loading}
          className="flex-1 rounded-md bg-happy-green px-3 py-2 text-sm font-medium text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {loading ? 'Armando la cuenta...' : 'Generar cuenta de cobro'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600"
        >
          Cerrar
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {statement && (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-gray-900">
            {statement.warehouseName} · {fecha(`${statement.from}T12:00:00-05:00`)} al{' '}
            {fecha(`${statement.to}T12:00:00-05:00`)}
          </p>

          {/* No especular. Los envíos anteriores a que la app llevara la cuenta
              no se listan ni se cobran: solo se dice cuántos hay y que no se
              sabe de quién fueron. Ese período se salda con la cuenta de cobro
              de la propia bodega. */}
          {statement.sinRegistro > 0 && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
              <span className="font-semibold">
                Hay {statement.sinRegistro} envío{statement.sinRegistro === 1 ? '' : 's'} en este rango que no
                está{statement.sinRegistro === 1 ? '' : 'n'} en la cuenta.
              </span>{' '}
              Son de antes de que la app registrara quién despachaba: existen, pero{' '}
              <span className="font-semibold">no hay forma de saber si fueron de esta bodega</span>. Ese
              período se salda con la cuenta de cobro que ella misma pasó — regístrala abajo como ajuste,
              con el total que cobró.
            </div>
          )}

          {statement.lines.length === 0 ? (
            <p className="text-xs text-gray-400">
              No hay envíos registrados de esta bodega en ese rango.
            </p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="text-gray-400">
                <tr>
                  {/* El producto va primero: es por donde la bodega reconoce el
                      envío. El número de venta queda para que Jen lo cruce
                      contra Mercado Libre, pero ellos no lo ven en su cuenta. */}
                  <th className="pb-1 pr-2 font-medium">Producto</th>
                  <th className="pb-1 pr-2 font-medium">Despachado</th>
                  {muestraCanal && <th className="pb-1 pr-2 font-medium">Canal</th>}
                  <th className="pb-1 pr-2 font-medium">Venta</th>
                  <th className="pb-1 text-right font-medium">Tarifa</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {statement.lines.map((l) => (
                  <tr key={l.shipmentId} className="border-t border-gray-100">
                    <td className="py-1 pr-2 font-medium text-gray-900">{l.product}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">{fechaHora(l.dispatchedAt)}</td>
                    {muestraCanal && <td className="py-1 pr-2 capitalize">{l.channel}</td>}
                    <td className="py-1 pr-2 whitespace-nowrap font-mono text-gray-400">#{l.saleNumber}</td>
                    <td className="py-1 text-right whitespace-nowrap">{formatCOP(l.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Los totales necesitan estructura propia: con la nota de un ajuste
              corriendo tres renglones al mismo nivel que "6 paquetes", no se
              distinguía qué era una línea de la cuenta y qué una explicación
              (lo reportó la usuaria el 2026-08-20). Cada ajuste va ahora en su
              propia caja, con el monto arriba a la derecha y la nota debajo,
              claramente subordinada. */}
          <div className="mt-3 border-t border-gray-200 pt-3 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-gray-600">
                {statement.packagesTotal} paquete{statement.packagesTotal === 1 ? '' : 's'} despachado
                {statement.packagesTotal === 1 ? '' : 's'}
              </span>
              <span className="whitespace-nowrap font-medium text-gray-900">
                {formatCOP(statement.packagesAmount)}
              </span>
            </div>

            {statement.adjustments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Otros conceptos</p>
                {statement.adjustments.map((a, i) => (
                  <div key={i} className="rounded-md bg-gray-50 p-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-gray-700">Ajuste</span>
                      <span className="whitespace-nowrap font-medium text-gray-900">{formatCOP(a.amount)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-gray-500">{a.note}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-gray-300 pt-2">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-gray-900">{formatCOP(statement.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Etiquetas, extras y correcciones. Vivía en el panel de quincenas; al quitarlo
 * se muda acá, porque sin esto no habría forma de cobrar lo que no es un
 * paquete despachado — y las etiquetas son plata real (Gina cobró $13.800 de
 * etiquetas en agosto).
 *
 * La fecha ya no es un cajón: se guarda tal cual para que la cuenta de cobro de
 * un rango recoja los ajustes que caen dentro.
 */
function AdjustmentForm({ warehouseId, onDone }: { warehouseId: string; onDone: () => void }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(hoyBogota())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await addAdjustment({
      warehouseId,
      periodStart: date,
      packagesDelta: 0,
      amountDelta: Number(amount || 0),
      note,
    })

    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-gray-500">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          {/* Acepta negativos: un ajuste es tan seguido un descuento o algo
              contado dos veces como un extra. */}
          <label className="text-[11px] text-gray-500">Monto (+ o −)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="¿De qué es? Ej: impresión de etiquetas, stickers, descuento..."
        className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !amount || !note.trim()}
          className="flex-1 rounded-md bg-happy-green px-3 py-2 text-sm font-medium text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Agregar'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * `readOnly` es la vista de la bodega: los MISMOS números que ve la
 * administradora, sin los botones de registrar pago ni de borrar. Reusar el
 * componente es deliberado — si fueran dos componentes distintos podrían
 * mostrar cifras distintas, que es exactamente el problema que este panel
 * existe para eliminar.
 */
export function WarehouseLedgerCard({
  ledger,
  readOnly = false,
}: {
  ledger: WarehouseLedger
  readOnly?: boolean
}) {
  const router = useRouter()
  const [showPayment, setShowPayment] = useState(false)
  const [showStatement, setShowStatement] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    await deletePayment(id)
    setDeleting(null)
    router.refresh()
  }

  const debe = ledger.balance > 0
  const ultimoPago = ledger.payments[0] ?? null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700">{ledger.warehouseName}</h4>
        {/* Solo se separan las dos tarifas cuando de verdad son distintas.
            Galerías cobra lo mismo por los dos canales y ademas NUNCA hace Flex
            (regla firme del negocio: solo Gina hace Flex), asi que anunciar
            "Flex $5.000" ahi era informacion falsa — lo noto la usuaria el
            2026-08-20. */}
        <span className="text-[11px] text-gray-400">
          {ledger.feePerPackageFlex === ledger.feePerPackageAgencia
            ? `${formatCOP(ledger.feePerPackageAgencia)} por paquete`
            : `Flex ${formatCOP(ledger.feePerPackageFlex)} · Agencia ${formatCOP(ledger.feePerPackageAgencia)}`}
        </span>
      </div>

      {/* Dos bloques, no un total revuelto: lo que YA se pagó y hasta cuándo, y
          lo que se debe desde entonces. Antes la tarjeta mostraba "N paquetes
          despachados" del período completo —ya cobrado en parte— y ese número
          no correspondía al saldo. */}
      {ultimoPago && (
        <div className="mb-3 rounded-md bg-gray-50 p-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Ya pagado</span>
            <span className="text-[11px] text-gray-400">{fecha(ultimoPago.paidAt)}</span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-gray-600">
              {ultimoPago.packages !== null && `${ultimoPago.packages} paquetes · `}
              hasta el {fecha(`${ledger.coveredThrough}T12:00:00-05:00`)}
            </span>
            <span className="font-medium text-gray-900">{formatCOP(ledger.totalPaid)}</span>
          </div>
          {ledger.shortfall !== 0 && (
            <p className="mt-1 text-[11px] leading-snug text-amber-700">
              {ledger.shortfall > 0 ? (
                <>
                  Quedó debiendo <span className="font-semibold">{formatCOP(ledger.shortfall)}</span> de ese
                  período: se pagó menos de lo que había generado.
                </>
              ) : (
                <>
                  Se pagó <span className="font-semibold">{formatCOP(-ledger.shortfall)}</span> de más en ese
                  período.
                </>
              )}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1 text-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {ledger.coveredThrough
            ? `Desde el ${fecha(`${siguienteDia(ledger.coveredThrough)}T12:00:00-05:00`)}`
            : 'Todo lo generado'}
        </p>
        <div className="flex justify-between text-gray-600">
          <span>
            {ledger.pendingPackages} paquete{ledger.pendingPackages === 1 ? '' : 's'} despachado
            {ledger.pendingPackages === 1 ? '' : 's'}
          </span>
          <span>{formatCOP(ledger.pendingAmount)}</span>
        </div>
        {ledger.pendingAdjustments !== 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Etiquetas y extras</span>
            <span>{formatCOP(ledger.pendingAdjustments)}</span>
          </div>
        )}
      </div>

      {/* El saldo es la respuesta a "¿cuánto le debo?", y es una sola sin
          importar por qué rango se haya cobrado. */}
      <div className="mt-2 flex items-baseline justify-between border-t-2 border-gray-200 pt-2">
        <span className="text-sm font-semibold text-gray-700">
          {debe ? (readOnly ? 'Te deben' : 'Le debemos') : 'Saldo'}
        </span>
        {/* Neutro, no verde: en este dashboard el verde significa plata que ENTRA
            (convención acordada el 2026-08-18). Un saldo por pagar es plata que
            sale, y tampoco es un estado malo — es un hecho. El peso lo da el
            tamaño. */}
        <span className={`text-2xl font-bold ${debe ? 'text-gray-900' : 'text-gray-400'}`}>
          {formatCOP(Math.abs(ledger.balance))}
        </span>
      </div>
      {ledger.balance < 0 && (
        <p className="mt-1 text-[11px] font-medium text-amber-700">
          Se pagó de más. Revisa si falta registrar despachos o si hubo un adelanto.
        </p>
      )}

      {!readOnly && (
        <>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            setShowPayment((v) => !v)
            setShowStatement(false)
            setShowAdjustment(false)
          }}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Registrar pago
        </button>
        <button
          onClick={() => {
            setShowStatement((v) => !v)
            setShowPayment(false)
            setShowAdjustment(false)
          }}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cuenta de cobro
        </button>
      </div>

      <button
        onClick={() => {
          setShowAdjustment((v) => !v)
          setShowPayment(false)
          setShowStatement(false)
        }}
        className="mt-2 text-xs text-happy-greenText hover:underline"
      >
        + Agregar etiquetas o extras
      </button>
      </>
      )}

      {showPayment && <PaymentForm ledger={ledger} onDone={() => setShowPayment(false)} />}
      {showStatement && <StatementPanel ledger={ledger} onClose={() => setShowStatement(false)} />}
      {showAdjustment && (
        <AdjustmentForm warehouseId={ledger.warehouseId} onDone={() => setShowAdjustment(false)} />
      )}

      {ledger.adjustments.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="mb-1 text-[11px] font-medium text-gray-400">Etiquetas y extras</p>
          <div className="space-y-1">
            {ledger.adjustments.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-gray-700">{formatCOP(a.amount)}</span>
                  <span className="text-gray-400">{' · '}{fecha(`${a.date}T12:00:00-05:00`)}</span>
                  <p className="text-[11px] leading-snug text-gray-400">{a.note}</p>
                </div>
                {!readOnly && (
                  <button
                    onClick={async () => {
                      setDeleting(a.id)
                      await removeAdjustment(a.id)
                      setDeleting(null)
                      router.refresh()
                    }}
                    disabled={deleting === a.id}
                    className="shrink-0 rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {deleting === a.id ? '...' : 'Quitar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {ledger.payments.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="mb-1 text-[11px] font-medium text-gray-400">Pagos registrados</p>
          <div className="space-y-1">
            {ledger.payments.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-gray-700">{formatCOP(p.amount)}</span>
                  <span className="text-gray-400">
                    {' · '}
                    {p.periodStart && p.periodEnd
                      ? `${fecha(`${p.periodStart}T12:00:00-05:00`)} al ${fecha(`${p.periodEnd}T12:00:00-05:00`)}`
                      : fecha(p.paidAt)}
                  </span>
                  {p.note && <p className="text-[11px] leading-snug text-gray-400">{p.note}</p>}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="shrink-0 rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {deleting === p.id ? '...' : 'Deshacer'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
