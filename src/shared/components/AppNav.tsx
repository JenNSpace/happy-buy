'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signout } from '@/actions/auth'
import type { UserRole } from '@/types/database'

interface Tab {
  label: string
  href: string
  roles: UserRole[]
  enabled: boolean
}

const TABS: Tab[] = [
  { label: 'Dashboard', href: '/dashboard', roles: ['admin'], enabled: true },
  { label: 'Logística', href: '/logistica', roles: ['admin', 'bodega'], enabled: true },
  { label: 'Compras', href: '/compras', roles: ['admin'], enabled: true },
  { label: 'Finanzas', href: '/finanzas', roles: ['admin'], enabled: false },
  { label: 'Productos', href: '/productos', roles: ['admin'], enabled: false },
]

export function AppNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(role))

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 pt-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Happy Buy" width={36} height={36} priority />
          <h1 className="text-xl font-bold text-gray-900">Happy Buy</h1>
        </div>
        <form action={signout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-happy-greenDark">
            Cerrar sesión
          </button>
        </form>
      </div>

      <nav className="mx-auto flex max-w-5xl gap-1 px-8 mt-4">
        {visibleTabs.map((tab) => {
          if (!tab.enabled) {
            return (
              <span
                key={tab.href}
                title="Próximamente"
                className="cursor-not-allowed rounded-t-lg px-4 py-2 text-sm font-medium text-gray-300"
              >
                {tab.label}
              </span>
            )
          }

          const isActive = pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-happy-green text-happy-greenDark'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
