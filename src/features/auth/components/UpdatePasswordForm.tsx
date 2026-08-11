'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updatePassword } from '@/actions/auth'

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)

  // The recovery link's tokens arrive as a URL hash fragment (Supabase's
  // own /verify endpoint redirects here without a template change, and
  // editing that template requires custom SMTP — blocked, confirmed
  // 2026-08-11). Fragments never reach the server, and @supabase/ssr's
  // browser client did NOT auto-detect/consume them here (tested live —
  // getSession()/onAuthStateChange never fired), so this parses the hash
  // by hand and calls setSession() directly, which writes the session as
  // a cookie the "updatePassword" Server Action can then read. Without
  // this the form posts with no session at all ("Auth session missing!").
  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      setCheckingSession(false)
      return
    }

    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ data: { session }, error }) => {
        if (session && !error) {
          setSessionReady(true)
          // Don't leave the tokens sitting in the URL/browser history.
          window.history.replaceState(null, '', window.location.pathname)
        }
        setCheckingSession(false)
      })
      .catch(() => setCheckingSession(false))
  }, [])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await updatePassword(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (checkingSession) {
    return <p className="text-sm text-gray-500">Verificando enlace...</p>
  }

  if (!sessionReady) {
    return (
      <p className="text-sm text-red-600">
        Este enlace ya expiró o no es válido. Pide un nuevo enlace desde &quot;¿Olvidaste tu contraseña?&quot;.
      </p>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          New Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-happy-green px-4 py-2 text-white hover:bg-happy-greenDark disabled:opacity-50"
      >
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  )
}
