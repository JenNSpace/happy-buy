import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
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
import type { AdsSummary } from '@/features/dashboard/types'

// Personalized, auth-gated financial data — never statically cache this route.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single<Profile>()

  if (profile?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <p className="text-gray-500">Tu panel estará disponible pronto.</p>
      </div>
    )
  }

  const summary = await getFinancialSummary(7)

  // Mercado Ads' endpoint is flaky (confirmed 503s from ML's own infra) —
  // isolate its failure so the rest of the dashboard still loads.
  let ads: AdsSummary | null = null
  let adsError: Error | null = null
  try {
    ads = await getAdsSummary(summary.marginRate || 0.122)
  } catch (e) {
    adsError = e instanceof Error ? e : new Error('Error desconocido')
  }

  const avgUnitPrice = summary.unitsSold > 0 ? summary.grossSales / summary.unitsSold : 0
  const netProfitAfterAds = summary.netProfit - (ads?.cost ?? 0)

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FinancialSummaryCard summary={summary} ads={ads} />

        <AdsWarningCard ads={ads} error={adsError} />

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
  )
}
