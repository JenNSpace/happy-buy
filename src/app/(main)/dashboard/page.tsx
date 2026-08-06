import { Suspense } from 'react'
import Image from 'next/image'
import { signout } from '@/actions/auth'
import { getFinancialSummary } from '@/features/dashboard/services/get-financial-summary'
import { getAdsSummary } from '@/features/dashboard/services/get-ads-summary'
import { FinancialSummaryCard } from '@/features/dashboard/components/FinancialSummaryCard'
import { Calculator } from '@/features/dashboard/components/Calculator'
import { AdsWarningCard } from '@/features/dashboard/components/AdsWarningCard'
import { CatalogSection } from '@/features/dashboard/components/CatalogSection'
import { ProductMarginSection } from '@/features/dashboard/components/ProductMarginSection'
import { RecommendationsSection } from '@/features/dashboard/components/RecommendationsSection'
import { SalesHistorySection } from '@/features/dashboard/components/SalesHistorySection'
import { ProductAdsPerformanceSection } from '@/features/dashboard/components/ProductAdsPerformanceSection'
import { CardSkeleton } from '@/features/dashboard/components/CardSkeleton'
import { GoalSection } from '@/features/goals/components/GoalSection'

// Personalized, auth-gated financial data — never statically cache this route.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const summary = await getFinancialSummary(7)
  const ads = await getAdsSummary(summary.marginRate || 0.122)
  const avgUnitPrice = summary.unitsSold > 0 ? summary.grossSales / summary.unitsSold : 0
  const netProfitAfterAds = summary.netProfit - (ads?.cost ?? 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Happy Buy" width={40} height={40} priority />
            <h1 className="text-3xl font-bold text-gray-900">Happy Buy</h1>
          </div>
          <form action={signout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-happy-greenDark">
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FinancialSummaryCard summary={summary} ads={ads} />

          <AdsWarningCard ads={ads} />

          <Suspense fallback={<CardSkeleton label="meta" />}>
            <GoalSection currentAmount={netProfitAfterAds} previousAmount={summary.previousPeriod.netProfit} />
          </Suspense>

          <Calculator marginRate={summary.marginRate} avgUnitPrice={avgUnitPrice} ads={ads} />

          <div className="md:col-span-2">
            <Suspense fallback={<CardSkeleton label="historial de ventas" />}>
              <SalesHistorySection />
            </Suspense>
          </div>

          <div className="md:col-span-2">
            <Suspense fallback={<CardSkeleton label="ads por producto" />}>
              <ProductAdsPerformanceSection marginRate={summary.marginRate} />
            </Suspense>
          </div>

          <div className="md:col-span-2">
            <Suspense fallback={<CardSkeleton label="consejos" />}>
              <RecommendationsSection summary={summary} ads={ads} />
            </Suspense>
          </div>

          <div className="md:col-span-2">
            <Suspense fallback={<CardSkeleton label="margen por producto" />}>
              <ProductMarginSection />
            </Suspense>
          </div>

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
