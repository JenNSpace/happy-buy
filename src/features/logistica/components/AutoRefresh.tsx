'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Re-fetches the logistics page on an interval. Two people work this screen at
 * once (admin in Guatavita, bodega in Bogotá) and the data is only as fresh as
 * the last page load — without this, a package Gina marks dispatched keeps
 * showing on the admin's open tab, which is exactly how a package gets taken
 * twice. Pauses while the tab is hidden so it doesn't burn ML API calls in a
 * background tab, and refreshes immediately on becoming visible again.
 */
export function AutoRefresh({ intervalMs = 120_000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }

    const interval = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [router, intervalMs])

  return null
}
