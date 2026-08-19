'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/shared/utils/format'
import { getFortnightLabel } from '../utils/dispatch-cutoff'
import { addAdjustment, removeAdjustment, markFortnightPaid, undoFortnightPaid } from '../services/payment-actions'
import type { WarehouseEarnings } from '../services/get-warehouse-earnings'

function AdjustmentForm({
  warehouseId,
  periodStart,
  onDone,
}: {
  warehouseId: string
  periodStart: string
  onDone: () => void
}) {
  const router = useRouter()
  const [packages, setPackages] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await addAdjustment({
      warehouseId,
      periodStart,
      packagesDelta: Number(packages || 0),
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
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded-md bg-gray-50 p-3">
      {/* Both fields take negatives: an adjustment is as often a discount or a
          correction of something counted twice as it is an extra. */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-gray-500">Paquetes (+ o −)</label>
          <input
            type="number"
            value={packages}
            onChange={(e) => setPackages(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Dinero (+ o −)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="¿De qué es? Ej: impresión de etiquetas, descuento..."
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
      />
      <p className="text-[11px] text-gray-400">
        Usa negativo para restar. Puedes dejar los paquetes en 0 si solo es dinero (como las impresiones).
      </p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-happy-green px-3 py-1 text-xs text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:underline">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}

function WarehouseCard({ earnings }: { earnings: WarehouseEarnings }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const isPaid = Boolean(earnings.paidAt)

  async function handlePay() {
    setBusy(true)
    await markFortnightPaid({
      warehouseId: earnings.warehouseId,
      periodStart: earnings.periodStart,
      packages: earnings.totalPackages,
      amount: earnings.totalAmount,
    })
    setBusy(false)
    router.refresh()
  }

  async function handleUndo() {
    setBusy(true)
    await undoFortnightPaid(earnings.warehouseId, earnings.periodStart)
    setBusy(false)
    router.refresh()
  }

  async function handleRemove(id: string) {
    setBusy(true)
    await removeAdjustment(id)
    setBusy(false)
    router.refresh()
  }

  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        isPaid
          ? 'border-gray-200 bg-gray-50'
          : earnings.isPastDue
            ? 'border-amber-300 bg-amber-50'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-900">{earnings.warehouseName}</h4>
        {isPaid ? (
          <span className="rounded-full bg-happy-lime/40 px-2 py-0.5 text-[11px] font-medium text-happy-greenDark">
            Pagada
          </span>
        ) : (
          earnings.isPastDue && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-900">
              Sin pagar
            </span>
          )
        )}
      </div>

      {/* La quincena que cerró sin pagarse antes no aparecía en ninguna pantalla:
          se pagaba lo que se veía y quedaba un saldo invisible. */}
      <p className="mt-0.5 text-[11px] text-gray-500">{earnings.periodLabel}</p>

      <p className={`mt-2 text-2xl font-bold tabular-nums ${isPaid ? 'text-gray-400' : 'text-happy-greenDark'}`}>
        {formatCOP(earnings.totalAmount)}
      </p>
      <p className="text-xs text-gray-500">
        {earnings.totalPackages} {earnings.totalPackages === 1 ? 'paquete' : 'paquetes'}
      </p>

      <div className="mt-3 space-y-1 border-t border-gray-100 pt-2 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>Confirmado por Mercado Libre</span>
          <span className="tabular-nums">
            {earnings.autoPackages} · {formatCOP(earnings.autoAmount)}
          </span>
        </div>
        {earnings.adjustments.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-2 text-gray-600">
            <span className="min-w-0 flex-1 truncate" title={a.note}>
              {a.note}
            </span>
            <span className={`shrink-0 tabular-nums ${a.amountDelta < 0 ? 'text-red-600' : ''}`}>
              {a.packagesDelta !== 0 && `${a.packagesDelta > 0 ? '+' : ''}${a.packagesDelta} · `}
              {a.amountDelta > 0 ? '+' : ''}
              {formatCOP(a.amountDelta)}
            </span>
            {!isPaid && (
              <button
                onClick={() => handleRemove(a.id)}
                disabled={busy}
                className="shrink-0 text-gray-300 hover:text-red-500"
                title="Quitar ajuste"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {!isPaid && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handlePay}
            disabled={busy || earnings.totalAmount <= 0}
            className="rounded-md bg-happy-greenDark px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Marcar pagada
          </button>
          {!adding && (
            <button onClick={() => setAdding(true)} className="text-xs text-happy-green hover:underline">
              + Agregar ajuste
            </button>
          )}
        </div>
      )}

      {isPaid && (
        <button onClick={handleUndo} disabled={busy} className="mt-3 text-xs text-gray-400 hover:underline">
          Deshacer pago
        </button>
      )}

      {adding && (
        <AdjustmentForm
          warehouseId={earnings.warehouseId}
          periodStart={earnings.periodStart}
          onDone={() => setAdding(false)}
        />
      )}
    </div>
  )
}

/**
 * Per-warehouse payout for the open fortnight. One card per person because
 * they're paid separately — a combined figure was useless when Daniel was up
 * to date and Gina wasn't. Each shows what ML confirmed on its own versus what
 * was added by hand, so the automatic number is never silently overwritten.
 */
export function AdminEarningsSummary({ earnings }: { earnings: WarehouseEarnings[] }) {
  if (earnings.length === 0) return null

  const pendientes = earnings.filter((e) => e.isPastDue && !e.paidAt)

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Pago de la quincena · {getFortnightLabel()}
      </p>

      {pendientes.length > 0 && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-gray-700">
          Hay {pendientes.length === 1 ? 'una quincena anterior' : `${pendientes.length} quincenas anteriores`} sin
          pagar. {pendientes.length === 1 ? 'Aparece' : 'Aparecen'} abajo junto con la actual.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {earnings.map((e) => (
          <WarehouseCard key={`${e.warehouseId}-${e.periodStart}`} earnings={e} />
        ))}
      </div>
    </div>
  )
}
