'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP, formatPercent } from '@/shared/utils/format'
import { updateCardSettings } from '../services/finanzas-actions'
import type { Debt } from '../services/get-debts'

/**
 * Verde bajo 50%, ámbar entre 50 y 80, rojo por encima.
 *
 * Este SÍ es un rojo merecido: quedarse sin cupo bloquea la próxima compra de
 * producto, que es lo único que para el negocio. Distinto de "debes plata", que
 * es operación normal y va en gris.
 */
function usageColor(usage: number): { bar: string; text: string } {
  if (usage > 0.8) return { bar: 'bg-red-500', text: 'text-red-600' }
  if (usage > 0.5) return { bar: 'bg-amber-500', text: 'text-amber-600' }
  return { bar: 'bg-happy-green', text: 'text-happy-greenText' }
}

export function DebtCard({ debt }: { debt: Debt }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  const { method, owed, usage, available, nextStatement } = debt
  const colors = usage != null ? usageColor(usage) : null

  const detalle = [
    debt.purchaseCount > 0 && `${debt.purchaseCount} ${debt.purchaseCount === 1 ? 'compra' : 'compras'}`,
    debt.expenseCount > 0 && `${debt.expenseCount} ${debt.expenseCount === 1 ? 'gasto' : 'gastos'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{method.name}</h3>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Debes</p>
      <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCOP(owed)}</p>
      <p className="mt-0.5 text-sm text-gray-500">{detalle || 'todo al día'}</p>

      {usage != null && colors ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${colors.bar}`}
              style={{ width: `${Math.min(usage * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className={`text-xs font-medium ${colors.text}`}>{formatPercent(usage)} del cupo</span>
            <span className="text-xs text-gray-500">
              {available != null && `${formatCOP(available)} disponible`}
            </span>
          </div>
        </div>
      ) : (
        // Sin cupo registrado no se dibuja una barra vacía: parecería cupo lleno
        // o cupo cero, y ninguna de las dos cosas es verdad.
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 text-sm font-medium text-happy-greenText hover:underline"
        >
          Registrar cupo y fechas
        </button>
      )}

      {(method.statement_day || method.due_day) && (
        <p className="mt-3 text-xs text-gray-500">
          {method.statement_day && <>Corta el {method.statement_day}</>}
          {method.statement_day && method.due_day && ' · '}
          {method.due_day && <>Paga el {method.due_day}</>}
          {nextStatement && <span className="text-gray-400"> · próximo corte {nextStatement}</span>}
        </p>
      )}

      {usage != null && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 text-xs text-gray-400 hover:text-happy-greenText"
        >
          Editar cupo y fechas
        </button>
      )}

      {editing && (
        <CardSettingsForm
          debt={debt}
          onDone={() => {
            setEditing(false)
            router.refresh()
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

function CardSettingsForm({
  debt,
  onDone,
  onCancel,
}: {
  debt: Debt
  onDone: () => void
  onCancel: () => void
}) {
  const [limit, setLimit] = useState(debt.method.credit_limit?.toString() ?? '')
  const [statementDay, setStatementDay] = useState(debt.method.statement_day?.toString() ?? '')
  const [dueDay, setDueDay] = useState(debt.method.due_day?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await updateCardSettings({
      methodId: debt.method.id,
      creditLimit: limit.trim() === '' ? null : Number(limit),
      statementDay: statementDay.trim() === '' ? null : Number(statementDay),
      dueDay: dueDay.trim() === '' ? null : Number(dueDay),
    })

    setSaving(false)
    if (result?.error) setError(result.error)
    else onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <label className="block">
        <span className="text-xs text-gray-500">Cupo total</span>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="Ej: 1500000"
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-500">Día de corte</span>
          <input
            type="number"
            min="1"
            max="31"
            value={statementDay}
            onChange={(e) => setStatementDay(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Día de pago</span>
          <input
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-happy-green px-3 py-1.5 text-sm font-medium text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </button>
      </div>
    </form>
  )
}
