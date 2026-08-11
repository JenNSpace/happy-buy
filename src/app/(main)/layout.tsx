import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/shared/components/AppNav'
import type { Profile } from '@/types/database'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const role = profile?.role ?? 'bodega'

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav role={role} />
      <main>{children}</main>
    </div>
  )
}
