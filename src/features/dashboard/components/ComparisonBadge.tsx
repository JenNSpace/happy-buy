export function ComparisonBadge({
  current,
  previous,
  invert = false,
}: {
  current: number
  previous: number
  invert?: boolean
}) {
  if (previous === 0) return null

  const change = (current - previous) / Math.abs(previous)
  if (Math.abs(change) < 0.001) return null

  const isGood = invert ? change < 0 : change > 0
  const sign = change > 0 ? '+' : ''

  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
        isGood ? 'bg-happy-green/10 text-happy-greenDark' : 'bg-red-100 text-red-600'
      }`}
    >
      {sign}
      {(change * 100).toFixed(0)}%
    </span>
  )
}
