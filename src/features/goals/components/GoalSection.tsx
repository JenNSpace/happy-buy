import { getGoal } from '../services/get-goal'
import { GoalProgressCard } from './GoalProgressCard'
import { GoalSettingsForm } from './GoalSettingsForm'

export async function GoalSection({
  currentAmount,
  previousSales,
  previousProfit,
}: {
  currentAmount: number
  previousSales: number
  previousProfit: number
}) {
  const goal = await getGoal()

  return (
    <div className="space-y-2">
      <GoalProgressCard
        goal={goal}
        currentAmount={currentAmount}
        previousSales={previousSales}
        previousProfit={previousProfit}
      />
      <GoalSettingsForm currentTarget={goal?.target_amount ?? null} previousProfit={previousProfit} />
    </div>
  )
}
