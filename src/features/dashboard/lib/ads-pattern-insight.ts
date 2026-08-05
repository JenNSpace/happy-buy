interface SalesBucket {
  value: number
}

interface AdsBucket {
  cost: number
  totalAmount: number
}

export interface AdsPatternInsight {
  salesLiftPercent: number
  weekendRoas: number
  weekdayRoas: number
  hasAdsData: boolean
  message: string
}

/**
 * Both arrays must be 7 buckets, Mon..Sun (index 5=Sáb, 6=Dom) — the shape
 * bucketSalesHistory('weekday', ...) and getAdsWeekdayPattern() already
 * return.
 */
export function computeAdsPatternInsight(
  salesBuckets: SalesBucket[],
  adsBuckets: AdsBucket[]
): AdsPatternInsight {
  const weekdaySalesAvg = salesBuckets.slice(0, 5).reduce((s, b) => s + b.value, 0) / 5
  const weekendSalesAvg = (salesBuckets[5].value + salesBuckets[6].value) / 2
  const salesLiftPercent =
    weekdaySalesAvg > 0 ? ((weekendSalesAvg - weekdaySalesAvg) / weekdaySalesAvg) * 100 : 0

  const weekendCost = adsBuckets[5].cost + adsBuckets[6].cost
  const weekendAmount = adsBuckets[5].totalAmount + adsBuckets[6].totalAmount
  const weekdayCost = adsBuckets.slice(0, 5).reduce((s, b) => s + b.cost, 0)
  const weekdayAmount = adsBuckets.slice(0, 5).reduce((s, b) => s + b.totalAmount, 0)

  const weekendRoas = weekendCost > 0 ? weekendAmount / weekendCost : 0
  const weekdayRoas = weekdayCost > 0 ? weekdayAmount / weekdayCost : 0
  const hasAdsData = weekendCost > 0 && weekdayCost > 0

  let message: string

  if (!hasAdsData) {
    message =
      weekendCost === 0
        ? 'Casi no estás invirtiendo en ads los fines de semana — si ahí vendes más, podrías estar dejando plata sobre la mesa.'
        : 'Todavía no hay suficientes datos de ads para comparar fin de semana vs. entre semana con confianza.'
  } else if (salesLiftPercent > 15 && weekendRoas >= weekdayRoas * 0.9) {
    message = `Vendes ${salesLiftPercent.toFixed(0)}% más el fin de semana y tu ROAS ahí (${weekendRoas.toFixed(1)}x) aguanta bien comparado con entre semana (${weekdayRoas.toFixed(1)}x) — vale la pena mover presupuesto de ads hacia viernes-domingo.`
  } else if (salesLiftPercent > 15 && weekendRoas < weekdayRoas * 0.9) {
    message = `Vendes ${salesLiftPercent.toFixed(0)}% más el fin de semana, pero tu ROAS ahí (${weekendRoas.toFixed(1)}x) es más bajo que entre semana (${weekdayRoas.toFixed(1)}x) — antes de subir presupuesto el finde, prueba con montos pequeños y mide si el ROAS aguanta.`
  } else if (salesLiftPercent < -15) {
    message = `Vendes menos el fin de semana (${Math.abs(salesLiftPercent).toFixed(0)}% menos) — puede tener más sentido concentrar el presupuesto de ads entre semana.`
  } else {
    message = 'Tus ventas no varían mucho entre fin de semana y entre semana — no hay una señal clara para mover presupuesto por día.'
  }

  return { salesLiftPercent, weekendRoas, weekdayRoas, hasAdsData, message }
}
