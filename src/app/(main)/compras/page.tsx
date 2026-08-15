import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import { getStockByWarehouse, getIncomingByWarehouse } from '@/features/inventario/services/get-stock'
import { getProducts } from '@/features/inventario/services/get-product-catalog'
import { getPurchases } from '@/features/inventario/services/get-purchases'
import { getPaymentMethods } from '@/features/inventario/services/get-payment-methods'
import { getProductPhotos } from '@/features/inventario/services/get-product-photos'
import { discoverListings } from '@/features/inventario/services/discover-listings'
import { StockTable } from '@/features/inventario/components/StockTable'
import { PurchaseForm } from '@/features/inventario/components/PurchaseForm'
import { PurchasesList } from '@/features/inventario/components/PurchasesList'
import { AdjustStockForm } from '@/features/inventario/components/AdjustStockForm'
import { UnmappedListingsAlert } from '@/features/inventario/components/UnmappedListingsAlert'

export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
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
        <p className="text-gray-500">Esta sección estará disponible pronto.</p>
      </div>
    )
  }

  const [stock, incoming, products, purchases, paymentMethods, { data: warehouses }, unmapped, photos] = await Promise.all([
    getStockByWarehouse(),
    getIncomingByWarehouse(),
    getProducts(),
    getPurchases(),
    getPaymentMethods(),
    supabase.from('warehouses').select('*').order('name'),
    discoverListings(),
    getProductPhotos(),
  ])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <h2 className="text-2xl font-bold text-gray-900">Compras e Inventario</h2>

      <UnmappedListingsAlert listings={unmapped} />

      <StockTable stock={stock} warehouses={warehouses ?? []} photos={photos} incoming={incoming} />

      <PurchaseForm products={products} warehouses={warehouses ?? []} paymentMethods={paymentMethods} photos={photos} />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Compras</h3>
        <PurchasesList
          purchases={purchases}
          products={products}
          warehouses={warehouses ?? []}
          paymentMethods={paymentMethods}
          photos={photos}
        />
      </div>

      <AdjustStockForm products={products} warehouses={warehouses ?? []} />
    </div>
  )
}
