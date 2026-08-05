import { getGoal } from '../services/get-goal'
import { GoalProgressCard } from './GoalProgressCard'
import { GoalSettingsForm } from './GoalSettingsForm'

export async function GoalSection({
  currentAmount,
  previousAmount,
}: {
  currentAmount: number
  previousAmount: number
}) {
  const goal = await getGoal()

  return (
    <div className="space-y-2">
      <GoalProgressCard goal={goal} currentAmount={currentAmount} previousAmount={previousAmount} />
      <GoalSettingsForm currentTarget={goal?.target_amount ?? null} previousAmount={previousAmount} />
    </div>
  )
}
