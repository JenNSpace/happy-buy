import { formatCOP, formatPercent } from '@/shared/utils/format'
import type { AdsSummary, FinancialSummary, ProductMargin, Recommendation } from '../types'

const MARGIN_SHIFT_THRESHOLD = 0.02 // 2 percentage points
const PRODUCT_MARGIN_GAP_THRESHOLD = 0.03 // 3 percentage points

/**
 * Pure rule-based function — no API calls. Reasons over data the dashboard
 * services already fetched (financial summary, ads, per-product margin).
 */
export function getRecommendations(
  summary: FinancialSummary,
  ads: AdsSummary | null,
  products: ProductMargin[]
): Recommendation[] {
  const recommendations: Recommendation[] = []

  if (summary.netProfit <= 0) {
    recommendations.push({
      severity: 'urgent',
      message: `Estás perdiendo plata este período: ganancia neta de ${formatCOP(summary.netProfit)}. Revisa costos y precios antes de seguir vendiendo así.`,
    })
  }

  if (ads?.isLosingMoney) {
    recommendations.push({
      severity: 'urgent',
      message: `"${ads.campaignName}" está perdiendo plata en Mercado Ads — necesitas mínimo ${ads.breakEvenRoas.toFixed(1)}x de ROAS para no perder y estás en ${ads.roas.toFixed(2)}x. Súbelo o pausa la campaña.`,
    })
  }

  const marginShift = summary.marginRate - summary.previousPeriod.marginRate
  if (marginShift <= -MARGIN_SHIFT_THRESHOLD) {
    recommendations.push({
      severity: 'warning',
      message: `Tu margen bajó ${Math.abs(marginShift * 100).toFixed(1)} puntos vs la semana pasada (${formatPercent(summary.previousPeriod.marginRate)} → ${formatPercent(summary.marginRate)}).`,
    })
  } else if (marginShift >= MARGIN_SHIFT_THRESHOLD) {
    recommendations.push({
      severity: 'good',
      message: `Tu margen subió ${(marginShift * 100).toFixed(1)} puntos vs la semana pasada (${formatPercent(summary.previousPeriod.marginRate)} → ${formatPercent(summary.marginRate)}) — vas bien.`,
    })
  }

  if (products.length >= 2) {
    const best = products[0]
    const worst = products[products.length - 1]
    const gap = best.marginRate - worst.marginRate
    if (gap >= PRODUCT_MARGIN_GAP_THRESHOLD) {
      recommendations.push({
        severity: 'warning',
        message: `"${worst.title}" deja ${(gap * 100).toFixed(1)} puntos menos de margen que "${best.title}" — empuja el producto de mejor margen.`,
      })
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'good',
      message: `Todo estable: margen de ${formatPercent(summary.marginRate)} sin alertas esta semana.`,
    })
  }

  const severityOrder: Record<Recommendation['severity'], number> = { urgent: 0, warning: 1, good: 2 }
  return recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}
