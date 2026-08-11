'use client'

import { useEffect, useState } from 'react'
import { getCountdownInfo, TIER_TEXT_STYLE, TIER_ICON } from '../utils/countdown'

export function Countdown({ deadline }: { deadline: string | null }) {
  const [info, setInfo] = useState(() => getCountdownInfo(deadline))

  useEffect(() => {
    setInfo(getCountdownInfo(deadline))
    const interval = setInterval(() => setInfo(getCountdownInfo(deadline)), 60_000)
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <span className={`text-xs ${TIER_TEXT_STYLE[info.tier]}`}>
      {TIER_ICON[info.tier]} {info.label}
    </span>
  )
}
