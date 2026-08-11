'use client'

import { useEffect, useState } from 'react'
import { getCountdownInfo } from '../utils/countdown'

/**
 * Rolls up every visible deadline into one "you need to act now" line —
 * a single package buried in a long list is easy to miss, this isn't.
 */
export function UrgencyBanner({ deadlines }: { deadlines: (string | null)[] }) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const infos = deadlines.map((d) => getCountdownInfo(d))
  const overdue = infos.filter((i) => i.tier === 'overdue').length
  const urgent = infos.filter((i) => i.tier === 'urgent').length

  if (overdue === 0 && urgent === 0) return null

  return (
    <div className="mb-4 space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {overdue > 0 && (
        <p>
          🔴 {overdue} paquete{overdue > 1 ? 's' : ''} venci{overdue > 1 ? 'eron' : 'ó'} su fecha límite de
          entrega.
        </p>
      )}
      {urgent > 0 && (
        <p>
          ⏰ {urgent} paquete{urgent > 1 ? 's' : ''} con menos de 1 hora para el corte — hay que despacharlo
          {urgent > 1 ? 's' : ''} ya.
        </p>
      )}
    </div>
  )
}
