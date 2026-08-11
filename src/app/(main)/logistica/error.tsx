'use client'

import { useEffect } from 'react'
import { friendlyErrorMessage } from '@/shared/utils/classify-error'

export default function LogisticaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const { title, body } = friendlyErrorMessage(error)

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">{title}</h2>
        <p className="mt-2 text-sm text-amber-800">{body}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-happy-green px-4 py-2 text-sm text-white hover:bg-happy-greenDark"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
