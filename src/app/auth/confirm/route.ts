import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Not wired up yet — the recovery email template would need to link here
 * (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`)
 * instead of Supabase's default `{{ .ConfirmationURL }}`, and editing email
 * templates requires custom SMTP configured first (Supabase's dashboard
 * blocks template edits on the default/shared email sender — confirmed
 * live 2026-08-11). The actual fix for "Auth session missing!" shipped
 * client-side instead (`UpdatePasswordForm.tsx` now processes the
 * recovery token from the URL hash directly, which works with Supabase's
 * unmodified default template). Kept here as the more standard PKCE-style
 * path for whenever custom SMTP gets set up (see `/add-emails`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(next)
    }
  }

  redirect('/forgot-password')
}
