'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/shared/utils/format'
import { SURFACE_CARD, EYEBROW, HAIRLINE_T, PILL, FIELD, BUTTON_PRIMARY } from '@/shared/ui/surface'
import { addAllocation, deleteAllocation } from '../services/mp-allocation-actions'
import type { MovementsView, MovementWithAllocations } from '../services/get-mp-movements'
import type { UnpaidPurchase } from '../services/get-unpaid-purchases'
import type { LinkableWarehousePayment } from '../services/get-warehouse-payments'
import type { MpCategory } from '@/types/database'

/**
 * Etiquetas de categoría. `personal` es la que más importa que exista: sin ella
 * la gente clasifica un gasto de la casa como "otro" y termina contaminando los
 * costos del negocio.
 */
const CATEGORY_LABEL: Record<MpCategory, string> = {
  producto: 'Producto',
  bodegas: 'Bodegas',
  insumos: 'Insumos y etiquetas',
  publicidad: 'Publicidad',
  personal: 'Personal',
  otro: 'Otro',
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as MpCategory[]

/** Gris para todo lo del negocio; lo personal se distingue para poder descontarlo de un vistazo. */
const CATEGORY_STYLE: Record<MpCategory, string> = {
  producto: 'bg-gray-900 text-white',
  bodegas: 'bg-gray-700 text-white',
  insumos: 'bg-gray-200 text-gray-800',
  publicidad: 'bg-gray-200 text-gray-800',
  personal: 'bg-violet-100 text-violet-700',
  otro: 'bg-gray-200 text-gray-800',
}

const KIND_LABEL = {
  payout: 'Retiro al banco',
  purchase: 'Compra desde Mercado Pago',
  advance_fee: 'Costo de adelantar la plata',
} as const

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

function AllocationForm({
  movementId,
  available,
  purchases,
  warehousePayments,
}: {
  movementId: string
  available: number
  purchases: UnpaidPurchase[]
  warehousePayments: LinkableWarehousePayment[]
}) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<MpCategory>('producto')
  const [note, setNote] = useState('')
  const [purchaseId, setPurchaseId] = useState('')
  const [warehousePaymentId, setWarehousePaymentId] = useState('')
  const [alsoRecordExpense, setAlsoRecordExpense] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cada categoría se cruza con un sistema distinto — o con ninguno.
  const canLinkPurchase = category === 'producto' && purchases.length > 0
  const freePayments = warehousePayments.filter((p) => !p.alreadyLinked)
  const canLinkWarehousePayment = category === 'bodegas' && freePayments.length > 0
  // Lo único que NO está contado en ningún otro lado, así que sí puede crear gasto.
  const canRecordExpense = category === 'insumos' || category === 'publicidad' || category === 'otro'

  const linked = purchases.find((p) => p.id === purchaseId) ?? null
  const linkedPayment = freePayments.find((p) => p.id === warehousePaymentId) ?? null

  function pickWarehousePayment(id: string) {
    setWarehousePaymentId(id)
    const payment = freePayments.find((p) => p.id === id)
    if (!payment) return
    setAmount(String(Math.round(Math.min(payment.amount, available))))
    setNote(`Pago a ${payment.warehouseName}`)
  }

  function pickPurchase(id: string) {
    setPurchaseId(id)
    const purchase = purchases.find((p) => p.id === id)
    if (!purchase) return
    // Lo que falta de esa compra, sin pasarse de lo que queda del retiro.
    const missing = Math.max(0, purchase.amount - purchase.covered)
    setAmount(String(Math.round(Math.min(missing, available))))
    setNote(`${purchase.quantity} × ${purchase.productName}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await addAllocation({
      movementId,
      amount: Number(amount),
      category,
      note: note.trim() || undefined,
      purchaseId: category === 'producto' ? purchaseId : '',
      warehousePaymentId: category === 'bodegas' ? warehousePaymentId : '',
      alsoRecordExpense: canRecordExpense && alsoRecordExpense,
    })

    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setAmount('')
    setNote('')
    setPurchaseId('')
    setWarehousePaymentId('')
    setAlsoRecordExpense(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className={`mt-3 pt-3 ${HAIRLINE_T}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[7rem] flex-1">
          <span className="text-xs text-gray-500">Monto</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(Math.round(available))}
            className={`mt-1 w-full ${FIELD}`}
          />
        </label>

        <label className="min-w-[9rem] flex-1">
          <span className="text-xs text-gray-500">¿En qué se fue?</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as MpCategory)
              setPurchaseId('')
              setWarehousePaymentId('')
              setAlsoRecordExpense(false)
            }}
            className={`mt-1 w-full ${FIELD}`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[10rem] flex-[2]">
          <span className="text-xs text-gray-500">Detalle (opcional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: 200 bolsas Sal Céltica"
            className={`mt-1 w-full ${FIELD}`}
          />
        </label>

        <button type="submit" disabled={saving || !amount} className={BUTTON_PRIMARY}>
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
      </div>

      {canLinkPurchase && (
        <label className="mt-2 block">
          <span className="text-xs text-gray-500">¿Paga alguna compra ya registrada? (opcional)</span>
          <select
            value={purchaseId}
            onChange={(e) => pickPurchase(e.target.value)}
            className={`mt-1 w-full ${FIELD}`}
          >
            <option value="">No la cruces con ninguna</option>
            {purchases.map((p) => {
              const missing = p.amount - p.covered
              return (
                <option key={p.id} value={p.id}>
                  {p.quantity} × {p.productName} · {formatCOP(missing)}
                  {p.covered > 0 ? ' por cubrir' : ''}
                  {p.methodName ? ` · ${p.methodName}` : ''}
                </option>
              )
            })}
          </select>
        </label>
      )}

      {canLinkWarehousePayment && (
        <label className="mt-2 block">
          <span className="text-xs text-gray-500">¿Paga alguno de los pagos ya registrados? (opcional)</span>
          <select
            value={warehousePaymentId}
            onChange={(e) => pickWarehousePayment(e.target.value)}
            className={`mt-1 w-full ${FIELD}`}
          >
            <option value="">No lo cruces con ninguno</option>
            {freePayments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.warehouseName} · {formatCOP(p.amount)} · pagado el {formatDate(p.paidOn)}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Bodegas: el costo ya entró paquete por paquete al despachar. El pago
          solo salda la cuenta corriente, así que enlazar cierra el hilo y nada más. */}
      {linkedPayment && (
        <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
          Queda cruzado con el pago a {linkedPayment.warehouseName}. No se suma como gasto nuevo: lo que
          se gana la bodega ya entra al resultado paquete por paquete, el día que despacha.
        </p>
      )}

      {/* Insumos y publicidad son el único caso que NO está contado en otro
          lado. Por eso acá sí se ofrece crear el gasto — y por eso va apagado
          por defecto, para no duplicar los que ella ya escribe a mano. */}
      {canRecordExpense && (
        <label className="mt-2 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
          <input
            type="checkbox"
            checked={alsoRecordExpense}
            onChange={(e) => setAlsoRecordExpense(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-happy-green focus:ring-happy-green"
          />
          <span className="text-xs leading-relaxed text-gray-600">
            Registrarlo también como <strong className="font-semibold">gasto</strong>, para que baje la
            utilidad del mes. Márcalo solo si no lo escribiste ya en la lista de Gastos — si no, quedaría
            contado dos veces.
          </span>
        </label>
      )}

      {linked && (
        <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
          Esta compra quedará marcada como <strong className="font-semibold">pagada</strong> en Compras
          {linked.methodName ? <> y bajará la deuda de {linked.methodName}</> : null}. No se suma como
          gasto nuevo: su costo ya se contó el día que la hiciste.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}

function MovementCard({
  row,
  purchases,
  warehousePayments,
}: {
  row: MovementWithAllocations
  purchases: UnpaidPurchase[]
  warehousePayments: LinkableWarehousePayment[]
}) {
  const router = useRouter()
  const { movement, allocations, unassigned } = row
  const [open, setOpen] = useState(unassigned > 0)
  const [removing, setRemoving] = useState<string | null>(null)

  const splittable = movement.kind !== 'advance_fee'
  const fullyExplained = splittable && unassigned === 0 && allocations.length > 0

  async function handleRemove(id: string) {
    setRemoving(id)
    await deleteAllocation(id)
    setRemoving(null)
    router.refresh()
  }

  return (
    <div className={`${SURFACE_CARD} p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className={EYEBROW}>{KIND_LABEL[movement.kind]}</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums tracking-tight text-gray-900">
            {formatCOP(Number(movement.amount))}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">{formatDate(movement.moved_on)}</p>
        </div>

        {splittable && (
          <div className="text-right">
            {unassigned > 0 ? (
              <>
                <p className="text-sm font-semibold tabular-nums text-amber-700">
                  {formatCOP(unassigned)}
                </p>
                <p className="text-xs text-amber-700">sin explicar</p>
              </>
            ) : (
              <p className="text-xs font-medium text-happy-greenText">✓ Todo explicado</p>
            )}
          </div>
        )}
      </div>

      {allocations.length > 0 && (
        <ul className={`mt-3 space-y-1.5 pt-3 ${HAIRLINE_T}`}>
          {allocations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className={`${PILL} shrink-0 ${CATEGORY_STYLE[a.category]}`}>
                  {CATEGORY_LABEL[a.category]}
                </span>
                {a.note && <span className="min-w-0 truncate text-sm text-gray-600">{a.note}</span>}
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <span className="text-sm font-medium tabular-nums text-gray-900">
                  {formatCOP(Number(a.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  disabled={removing === a.id}
                  className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Quitar ${CATEGORY_LABEL[a.category]} de ${formatCOP(Number(a.amount))}`}
                >
                  {removing === a.id ? '…' : 'Quitar'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {splittable && unassigned > 0 && (
        <AllocationForm
          movementId={movement.id}
          available={unassigned}
          purchases={purchases}
          warehousePayments={warehousePayments}
        />
      )}

      {/* Ya cuadrado, el formulario estorba — pero sigue accesible por si hubo un error. */}
      {fullyExplained &&
        (open ? (
          <AllocationForm
            movementId={movement.id}
            available={0}
            purchases={purchases}
            warehousePayments={warehousePayments}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`mt-3 pt-3 text-xs text-gray-400 hover:text-happy-greenText ${HAIRLINE_T} w-full text-left`}
          >
            Corregir el reparto
          </button>
        ))}
    </div>
  )
}

export function MovementsSection({
  view,
  purchases,
  warehousePayments,
}: {
  view: MovementsView
  purchases: UnpaidPurchase[]
  warehousePayments: LinkableWarehousePayment[]
}) {
  const [showExplained, setShowExplained] = useState(false)

  if (view.movements.length === 0) {
    return (
      <section>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">A dónde se fue la plata</h3>
        <div className={`${SURFACE_CARD} p-6`}>
          <p className="text-sm text-gray-500">
            Todavía no se han sincronizado los movimientos de Mercado Pago. El reporte se genera una vez
            al día y va un par de días atrasado.
          </p>
        </div>
      </section>
    )
  }

  const pending = view.movements.filter((r) => r.movement.kind !== 'advance_fee' && r.unassigned > 0)
  const explained = view.movements.filter((r) => r.movement.kind !== 'advance_fee' && r.unassigned === 0)

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">A dónde se fue la plata</h3>
        {view.pendingCount > 0 && (
          <span className="text-sm tabular-nums text-amber-700">
            {formatCOP(view.pendingAmount)} sin explicar en {view.pendingCount}{' '}
            {view.pendingCount === 1 ? 'salida' : 'salidas'}
          </span>
        )}
      </div>

      {view.byCategory.length > 0 && (
        <div className={`${SURFACE_CARD} mb-4 p-4`}>
          <p className={EYEBROW}>Ya explicado, por destino</p>
          <ul className="mt-2 space-y-1">
            {view.byCategory.map(({ category, amount }) => (
              <li key={category} className="flex items-baseline justify-between gap-2">
                <span className={`${PILL} ${CATEGORY_STYLE[category as MpCategory]}`}>
                  {CATEGORY_LABEL[category as MpCategory]}
                </span>
                <span className="text-sm font-medium tabular-nums text-gray-900">{formatCOP(amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {pending.map((row) => (
          <MovementCard
            key={row.movement.id}
            row={row}
            purchases={purchases}
            warehousePayments={warehousePayments}
          />
        ))}
      </div>

      {explained.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowExplained((v) => !v)}
            className="mt-3 text-sm font-medium text-happy-greenText hover:underline"
          >
            {showExplained
              ? 'Ocultar las ya explicadas'
              : `Ver las ${explained.length} ya explicadas`}
          </button>
          {showExplained && (
            <div className="mt-3 space-y-3">
              {explained.map((row) => (
                <MovementCard
                  key={row.movement.id}
                  row={row}
                  purchases={purchases}
                  warehousePayments={warehousePayments}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* No se reparte en categorías: no lo gastó nadie, lo cobró Mercado Libre. Se
          muestra porque hoy no aparece en ningún otro lado del sistema. */}
      {view.advanceFees.count > 0 && (
        <div className={`${SURFACE_CARD} mt-4 p-4`}>
          <p className={EYEBROW}>Costo de adelantar la plata</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
            {formatCOP(view.advanceFees.total)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            En {view.advanceFees.count}{' '}
            {view.advanceFees.count === 1 ? 'adelanto' : 'adelantos'} — lo que cobra Mercado Libre por
            darte tu plata antes de la fecha de liberación. Todavía no está descontado en «Resultado por
            mes».
          </p>
        </div>
      )}
    </section>
  )
}
