import type { Recommendation, RecommendationSeverity } from '../types'

const SEVERITY_STYLE: Record<RecommendationSeverity, { dot: string; text: string }> = {
  urgent: { dot: 'bg-red-500', text: 'text-red-700' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700' },
  good: { dot: 'bg-happy-green', text: 'text-happy-greenDark' },
}

export function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Consejos</h2>

      <ul className="space-y-3">
        {recommendations.map((rec, i) => {
          const style = SEVERITY_STYLE[rec.severity]
          return (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <span className={style.text}>{rec.message}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
