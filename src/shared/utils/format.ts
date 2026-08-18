export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * es-CO uses a decimal COMMA. Hand-rolling this with toFixed() emitted an
 * English "13.3%" right next to hardcoded Spanish copy like "1,5%" in the same
 * card — two decimal conventions in one view quietly erodes trust in the numbers.
 */
export function formatPercent(rate: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate)
}
