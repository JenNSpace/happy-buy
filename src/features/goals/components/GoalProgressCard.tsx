import { formatCOP } from '@/shared/utils/format'
import type { Goal } from '@/types/database'

export function GoalProgressCard({ goal, currentAmount }: { goal: Goal | null; currentAmount: number }) {
  if (!goal) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Meta semanal</h2>
        <p className="mt-2 text-sm text-gray-500">Todavía no hay una meta configurada.</p>
      </div>
    )
  }

  const progress = goal.target_amount > 0 ? Math.min(currentAmount / goal.target_amount, 1) : 0
  const reached = currentAmount >= goal.target_amount

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Meta semanal</h2>
        <span className="text-sm text-gray-500">{Math.round(progress * 100)}%</span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${reached ? 'bg-happy-green' : 'bg-happy-lime'}`}
          style={{ width: `${Math.max(progress * 100, currentAmount > 0 ? 2 : 0)}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-gray-600">
        {formatCOP(currentAmount)} de {formatCOP(goal.target_amount)}
      </p>
    </div>
  )
}
