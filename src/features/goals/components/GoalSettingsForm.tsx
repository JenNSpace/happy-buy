'use client'

import { useState } from 'react'
import { updateGoal } from '../services/update-goal'

export function GoalSettingsForm({
  currentTarget,
  previousAmount,
}: {
  currentTarget: number | null
  previousAmount: number
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const suggestedTarget = previousAmount > 0 ? Math.round((previousAmount * 1.1) / 1000) * 1000 : null

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await updateGoal(formData)

    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-happy-green hover:underline">
        {currentTarget ? 'Editar meta' : 'Configurar meta'}
      </button>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          name="target_amount"
          type="number"
          min={1}
          step={1}
          defaultValue={currentTarget ?? suggestedTarget ?? ''}
          placeholder="Monto en COP"
          required
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-md bg-happy-green px-3 py-1 text-sm text-white hover:bg-happy-greenDark disabled:opacity-50"
        >
          {loading ? '...' : 'Guardar'}
        </button>
      </div>
      {!currentTarget && suggestedTarget && (
        <p className="text-xs text-gray-400">Sugerencia: 10% más que la semana pasada.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
