'use client'

import { useEffect, useState } from 'react'
import { getCountdownInfo } from '../utils/countdown'

export interface UrgencyItem {
  deadline: string | null
  /** ML da el envío por atrasado — ver `isLateForMl`. */
  isLate: boolean
}

/**
 * Resume en una línea lo que exige acción — un paquete solo, enterrado en una
 * lista larga, es fácil de pasar por alto.
 *
 * Deliberadamente NO cuenta los que ya se pasaron de nuestro corte pero salen
 * en la próxima ronda: nadie puede hacer nada con ellos hoy y anunciarlos como
 * urgentes vuelve el banner ruido de fondo.
 */
export function UrgencyBanner({ items }: { items: UrgencyItem[] }) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const infos = items.map((i) => getCountdownInfo(i.deadline, new Date(), { isLate: i.isLate }))
  const overdue = infos.filter((i) => i.tier === 'overdue').length
  const urgent = infos.filter((i) => i.tier === 'urgent').length

  if (overdue === 0 && urgent === 0) return null

  return (
    <div className="mb-4 space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {overdue > 0 && (
        <p>
          🔴 {overdue} paquete{overdue > 1 ? 's' : ''} atrasado{overdue > 1 ? 's' : ''} según Mercado Libre.
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
