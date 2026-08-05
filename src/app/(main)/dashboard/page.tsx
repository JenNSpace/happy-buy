import { Suspense } from 'react'
import { signout } from '@/actions/auth'
import { getFinancialSummary } from '@/features/dashboard/services/get-financial-summary'
import { FinancialSummaryCard } from '@/features/dashboard/components/FinancialSummaryCard'
import { AdsSection } from '@/features/dashboard/components/AdsSection'
import { CatalogSection } from '@/features/dashboard/components/CatalogSection'
import { CardSkeleton } from '@/features/dashboard/components/CardSkeleton'

// Personalized, auth-gated financial data — never statically cache this route.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const summary = await getFinancialSummary(7)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Happy Buy</h1>
          <form action={signout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FinancialSummaryCard summary={summary} />

          <Suspense fallback={<CardSkeleton label="Mercado Ads" />}>
            <AdsSection marginRate={summary.marginRate || 0.122} />
          </Suspense>

          <div className="md:col-span-2">
            <Suspense fallback={<CardSkeleton label="publicaciones" />}>
              <CatalogSection />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
