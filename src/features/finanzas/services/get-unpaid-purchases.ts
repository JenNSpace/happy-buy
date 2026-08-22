import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { PaymentMethod, Product, Purchase } from '@/types/database'

/**
 * Las compras que todavía deben plata, para poder decir "este retiro paga ESA".
 *
 * Solo las no pagadas: enlazar un retiro a una compra que ya figura pagada no
 * tendría efecto (la deuda ya bajó) y además chocaría con el trigger que
 * mantiene `paid` en sincronía con los repartos.
 */
export interface UnpaidPurchase {
  id: string
  /** total_cost + other_cost — lo que de verdad falta por cubrir. */
  amount: number
  productName: string
  quantity: number
  methodName: string | null
  boughtOn: string
  /** Cuánto ya cubrieron otros retiros. Permite abonar en varias veces. */
  covered: number
}

interface PurchaseJoin extends Pick<Purchase, 'id' | 'total_cost' | 'other_cost' | 'quantity' | 'created_at'> {
  product: Pick<Product, 'short_name'> | null
  payment_method: Pick<PaymentMethod, 'name'> | null
}

export async function getUnpaidPurchases(): Promise<UnpaidPurchase[]> {
  const supabase = await createClient()

  const [{ data: rows }, { data: allocations }] = await Promise.all([
    supabase
      .from('purchases')
      .select('id, total_cost, other_cost, quantity, created_at, product:products(short_name), payment_method:payment_methods(name)')
      .eq('paid', false)
      .order('created_at', { ascending: false })
      .returns<PurchaseJoin[]>(),
    supabase.from('mp_allocations').select('purchase_id, amount').not('purchase_id', 'is', null),
  ])

  const coveredByPurchase = new Map<string, number>()
  for (const a of allocations ?? []) {
    const id = a.purchase_id as string
    coveredByPurchase.set(id, (coveredByPurchase.get(id) ?? 0) + Number(a.amount))
  }

  return (rows ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.total_cost) + Number(p.other_cost ?? 0),
    productName: p.product?.short_name ?? 'Producto',
    quantity: p.quantity,
    methodName: p.payment_method?.name ?? null,
    boughtOn: p.created_at.slice(0, 10),
    covered: coveredByPurchase.get(p.id) ?? 0,
  }))
}
