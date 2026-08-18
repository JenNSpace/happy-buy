const BOGOTA_UTC_OFFSET = '-05:00'

/** Monday 00:00:00, Bogotá local time, of the week containing `now` — ISO instant. */
export function getBogotaWeekStart(now: Date = new Date()): string {
  const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const day = bogotaNow.getDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(bogotaNow)
  monday.setDate(bogotaNow.getDate() - diffToMonday)

  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00${BOGOTA_UTC_OFFSET}`
}

/**
 * The current week's bounds, shared by EVERY figure on the dashboard.
 *
 * Sales and ad spend must be read over the identical window: found live
 * 2026-08-18 that ad cost was being pulled for a rolling 7 days while sales
 * covered only the calendar week so far, so a Tuesday showed ~7 days of ad
 * spend subtracted from ~1.5 days of sales — turning a profitable week into
 * an apparent loss. Any new period-scoped metric should use this too.
 */
export function getCurrentWeekRange(now: Date = new Date()): { from: Date; to: Date } {
  return { from: new Date(getBogotaWeekStart(now)), to: now }
}
