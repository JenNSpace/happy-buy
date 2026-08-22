import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Expense, PaymentMethod, Profile, Warehouse } from '@/types/database'
import { getPnl } from '@/features/finanzas/services/get-pnl'
import { getDebts } from '@/features/finanzas/services/get-debts'
import { PnlTable } from '@/features/finanzas/components/PnlTable'
import { DebtCard } from '@/features/finanzas/components/DebtCard'
import { ExpenseForm } from '@/features/finanzas/components/ExpenseForm'
import { ExpensesList } from '@/features/finanzas/components/ExpensesList'
import { CardSkeleton } from '@/features/dashboard/components/CardSkeleton'
import { syncMlPayments } from '@/features/finanzas/services/sync-ml-payments'
import { getCashSummary } from '@/features/finanzas/services/get-cash-summary'
import { getCashFlow } from '@/features/finanzas/services/get-cash-flow'
import { CashSummaryCard } from '@/features/finanzas/components/CashSummaryCard'
import { CashFlowSection } from '@/features/finanzas/components/CashFlowSection'
import { CostModelChangeBanner } from '@/features/finanzas/components/CostModelChangeBanner'
import { getMpMovements } from '@/features/finanzas/services/get-mp-movements'
import { getUnpaidPurchases } from '@/features/finanzas/services/get-unpaid-purchases'
import { getWarehousePayments } from '@/features/finanzas/services/get-warehouse-payments'
import { MovementsSection } from '@/features/finanzas/components/MovementsSection'
import { SURFACE_CARD } from '@/shared/ui/surface'

export const dynamic = 'force-dynamic'

export default async function FinanzasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single<Profile>()

  // Doble barrera a propósito: la nav no muestra la pestaña y RLS niega las
  // tablas. Gina y Daniel no deben ver márgenes ni deudas, igual que hoy no ven
  // costos ni compras.
  if (profile?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <p className="text-gray-500">Esta sección estará disponible pronto.</p>
      </div>
    )
  }

  // Un fallo de sincronización no puede dejarla sin ver sus finanzas: se muestra
  // lo que haya guardado y se sigue.
  try {
    await syncMlPayments()
  } catch (e) {
    console.warn('[finanzas] No se pudieron sincronizar los pagos de Mercado Pago:', e)
  }

  const [summary, flow, debts, movements, unpaidPurchases, warehousePayments, { data: paymentMethods }, { data: expenses }, { data: warehouseRows }] =
    await Promise.all([
      getCashSummary(),
      getCashFlow(),
      getDebts(),
      getMpMovements(),
      getUnpaidPurchases(),
      getWarehousePayments(),
      supabase.from('payment_methods').select('*').order('name').returns<PaymentMethod[]>(),
      supabase.from('expenses').select('*').order('spent_on', { ascending: false }).limit(40).returns<Expense[]>(),
      supabase.from('warehouses').select('*').order('name').returns<Warehouse[]>(),
    ])

  const methods = paymentMethods ?? []
  const gastos = expenses ?? []
  const warehouses = warehouseRows ?? []

  const now = new Date()
  const currentMonth = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7)
  const monthTotal = gastos
    .filter((e) => e.spent_on.startsWith(currentMonth))
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const monthLabel = now.toLocaleDateString('es-CO', { month: 'long', timeZone: 'America/Bogota' })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <h2 className="text-2xl font-bold text-gray-900">Finanzas</h2>

      <CostModelChangeBanner />

      <CashSummaryCard summary={summary} />

      <CashFlowSection flow={flow} />

      <MovementsSection
        view={movements}
        purchases={unpaidPurchases}
        warehousePayments={warehousePayments}
      />

      {/* El P&L pide meses de órdenes y el libro de cargos de ML — lo más lento
          de la página. En Suspense para que lo de arriba se vea de inmediato. */}
      <Suspense fallback={<CardSkeleton label="resultado por mes" />}>
        <PnlSection />
      </Suspense>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Tarjetas y deudas</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {debts.map((debt) => (
            <DebtCard key={debt.method.id} debt={debt} />
          ))}
        </div>
      </section>

      <section className={`${SURFACE_CARD} p-6`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Gastos</h3>
          <ExpenseForm paymentMethods={methods} warehouses={warehouses} />
        </div>
        <ExpensesList
          expenses={gastos}
          paymentMethods={methods}
          warehouses={warehouses}
          monthTotal={monthTotal}
          monthLabel={monthLabel}
        />
      </section>
    </div>
  )
}

async function PnlSection() {
  const months = await getPnl()
  return <PnlTable months={months} />
}
