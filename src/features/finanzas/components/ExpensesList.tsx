'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/shared/utils/format'
import { deleteExpense } from '../services/finanzas-actions'
import type { Expense, PaymentMethod, Warehouse } from '@/types/database'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export function ExpensesList({
  expenses,
  paymentMethods,
  warehouses,
  monthTotal,
  monthLabel,
}: {
  expenses: Expense[]
  paymentMethods: PaymentMethod[]
  warehouses: Warehouse[]
  monthTotal: number
  monthLabel: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)
  // Confirmación en dos pasos, inline. Un modal para borrar una línea de $38.000
  // es desproporcionado, pero borrar de un solo clic es demasiado fácil.
  const [confirming, setConfirming] = useState<string | null>(null)
  const methodName = new Map(paymentMethods.map((m) => [m.id, m.name]))
  const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]))

  if (expenses.length === 0) {
    return (
      <p className="py-6 text-sm text-gray-500">
        Aún no has registrado gastos. Los empaques, cajas y cintas van aquí — no aparecen en ningún
        otro lado del sistema.
      </p>
    )
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await deleteExpense(id)
    setDeleting(null)
    setConfirming(null)
    router.refresh()
  }

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-3 py-2">
            <span className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 text-xs text-gray-400">{formatDate(e.spent_on)}</span>
              <span className="text-sm text-gray-700">
                {e.description || e.category}
                {e.description && <span className="ml-1.5 text-xs text-gray-400">{e.category}</span>}
                {e.warehouse_id && (
                  <span className="ml-1.5 text-xs text-gray-400">
                    {e.is_reimbursement ? 'reembolso a' : 'para'}{' '}
                    {warehouseName.get(e.warehouse_id) ?? 'bodega'}
                  </span>
                )}
              </span>
            </span>
            <span className="flex items-baseline gap-3">
              {e.payment_method_id && (
                <span className="text-xs text-gray-400">{methodName.get(e.payment_method_id)}</span>
              )}
              <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                {formatCOP(Number(e.amount))}
              </span>

              {confirming === e.id ? (
                <span className="flex shrink-0 items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    disabled={deleting === e.id}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deleting === e.id ? 'Borrando…' : 'Sí, borrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    No
                  </button>
                </span>
              ) : (
                // Visible siempre, no solo al pasar el mouse: en táctil no hay
                // hover y el botón sería inalcanzable.
                <button
                  type="button"
                  onClick={() => setConfirming(e.id)}
                  className="shrink-0 text-xs text-gray-400 hover:text-red-600"
                  aria-label={`Eliminar gasto de ${formatCOP(Number(e.amount))}`}
                >
                  Eliminar
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
        Total {monthLabel}:{' '}
        <span className="font-semibold tabular-nums text-gray-900">{formatCOP(monthTotal)}</span>
      </p>
    </>
  )
}
