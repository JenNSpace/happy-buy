/**
 * Whether Mercado Libre counts this shipment as late.
 *
 * Only ML's verdict decides this — OUR cutoff is stricter on purpose (Flex
 * 13:00 vs ML's 23:00) so the bodega catches the courier, and a package that
 * missed our internal cutoff is urgent without necessarily having hurt the
 * account. Conflating the two put a red "⚠ Afecta tu reputación" on an order
 * ML's own screen called on time (caught by the user 2026-08-19).
 *
 * Returns null when ML gave us no status: we then say nothing rather than
 * guess a verdict that is not ours to give.
 *
 * Lives in `utils/` and not next to the fetcher on purpose — the cards that
 * render it are client components, and importing it from a `server-only`
 * module breaks the build.
 */
export function affectsReputation(slaStatus: string | null): boolean | null {
  if (!slaStatus) return null
  return slaStatus !== 'on_time'
}
