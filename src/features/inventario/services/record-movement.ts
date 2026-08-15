'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * The only manual, freeform way to change stock — for correcting a physical
 * count. Purchases arriving (`entrada_compra`) and sales (`salida_venta`)
 * are never entered here; they're always system-derived (see
 * purchase-actions.ts and sync-sale-movements.ts) so the ledger stays tied
 * to a real purchase or shipment instead of an unaccountable manual entry.
 */
export async function recordAdjustment(input: { productId: string; warehouseId: string; qty: number; note?: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado' }
  if (input.qty === 0) return { error: 'La cantidad no puede ser cero' }

  const { error } = await supabase.from('inventory_movements').insert({
    product_id: input.productId,
    warehouse_id: input.warehouseId,
    qty: input.qty,
    type: 'ajuste',
    note: input.note || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/compras')
  return { success: true }
}
