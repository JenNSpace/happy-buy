import { getGoal } from '../services/get-goal'
import { GoalProgressCard } from './GoalProgressCard'
import { GoalSettingsForm } from './GoalSettingsForm'

export async function GoalSection({ currentAmount }: { currentAmount: number }) {
  const goal = await getGoal()

  return (
    <div className="space-y-2">
      <GoalProgressCard goal={goal} currentAmount={currentAmount} />
      <GoalSettingsForm currentTarget={goal?.target_amount ?? null} />
    </div>
  )
}
