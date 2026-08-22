'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExpense } from '../services/finanzas-actions'
import { formatCOP } from '@/shared/utils/format'
import type { PaymentMethod, Warehouse } from '@/types/database'

/** Lo único que Jen confirmó que gasta. "Otro" queda editable para lo que aparezca. */
const CATEGORIES = ['Empaques e insumos', 'Otro']
const OTHER = 'Otro'

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

export function ExpenseForm({
  paymentMethods,
  warehouses,
}: {
  paymentMethods: PaymentMethod[]
  warehouses: Warehouse[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState(today())
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [isReimbursement, setIsReimbursement] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ amount: number; category: string } | null>(null)

  function reset() {
    setDescription('')
    setAmount('')
    setSpentOn(today())
    setCustomCategory('')
    setWarehouseId('')
    setIsReimbursement(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const finalCategory = category === OTHER ? customCategory.trim() : category
    const result = await createExpense({
      category: finalCategory,
      description: description.trim() || undefined,
      amount: Number(amount),
      spentOn,
      paymentMethodId: paymentMethodId || '',
      warehouseId: warehouseId || '',
      isReimbursement,
    })

    setSaving(false)

    if (result?.error) {
      setError(result.error)
      return
    }

    // El panel NO se cierra solo. En la Fase 2 un panel que se autocerraba hizo
    // que un registro exitoso no se viera y se cargaran 100 unidades dos veces.
    // El éxito se queda a la vista hasta que ella lo cierre.
    setSaved({ amount: Number(amount), category: finalCategory })
    reset()
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-happy-green px-3 py-2 text-sm font-medium text-white hover:bg-happy-greenDark"
      >
        + Registrar gasto
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-900/[0.06]">
      {saved && (
        <div className="mb-4 rounded-xl border border-happy-green/30 bg-happy-green/5 p-3">
          <p className="text-sm font-medium text-gray-900">
            Gasto registrado: {formatCOP(saved.amount)} en {saved.category.toLowerCase()}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSaved(null)}
              className="text-sm font-medium text-happy-greenText hover:underline"
            >
              Registrar otro
            </button>
            <button
              type="button"
              onClick={() => {
                setSaved(null)
                setOpen(false)
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {!saved && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-gray-500">Categoría</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {category === OTHER && (
              <label className="block">
                <span className="text-xs text-gray-500">¿Cuál?</span>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Ej: transporte"
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs text-gray-500">Monto</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 38000"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Fecha</span>
              <input
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Pagado con</span>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Sin especificar</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Bodega</span>
              <select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value)
                  if (!e.target.value) setIsReimbursement(false)
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">No aplica</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Sin bodega la pregunta no tiene sentido, así que solo aparece
                cuando hay una elegida. */}
            {warehouseId && (
              <label className="block">
                <span className="text-xs text-gray-500">¿Quién compró?</span>
                <select
                  value={isReimbursement ? 'bodega' : 'yo'}
                  onChange={(e) => setIsReimbursement(e.target.value === 'bodega')}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="yo">Lo compré yo y se lo mandé</option>
                  <option value="bodega">Lo compró la bodega y le devolví la plata</option>
                </select>
              </label>
            )}
          </div>

          {/* El reembolso es justo el caso donde puede quedar anotado dos veces:
              acá y como ajuste de quincena en Logística. */}
          {isReimbursement && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
              Si este reembolso ya lo sumaste como ajuste en la quincena de Logística, no lo
              registres también acá — quedaría contado dos veces.
            </p>
          )}

          <label className="block">
            <span className="text-xs text-gray-500">Descripción (opcional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: cajas y cinta"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-happy-green px-3 py-2 text-sm font-medium text-white hover:bg-happy-greenDark disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar gasto'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
