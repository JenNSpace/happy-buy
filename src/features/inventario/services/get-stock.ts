import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Product, StockByWarehouseRow } from '@/types/database'

export interface StockRow {
  product: Product
  warehouseId: string
  stock: number
}

export async function getStockByWarehouse(): Promise<StockRow[]> {
  const supabase = await createClient()
  const [{ data: products }, { data: stock }] = await Promise.all([
    supabase.from('products').select('*').order('code').returns<Product[]>(),
    supabase.from('stock_by_warehouse').select('*').returns<StockByWarehouseRow[]>(),
  ])

  const productById = new Map((products ?? []).map((p) => [p.id, p]))

  return (stock ?? [])
    .map((row) => {
      const product = productById.get(row.product_id)
      if (!product) return null
      return { product, warehouseId: row.warehouse_id, stock: row.stock }
    })
    .filter((r): r is StockRow => r !== null)
}

/** Unidades pedidas que aún no llegan a bodega — no cuentan como stock, solo como referencia por bodega destino prevista. */
export async function getIncomingByWarehouse(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('purchases')
    .select('product_id, warehouse_id, quantity')
    .eq('status', 'pedido')
    .not('warehouse_id', 'is', null)

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = `${row.warehouse_id}:${row.product_id}`
    acc[key] = (acc[key] ?? 0) + row.quantity
    return acc
  }, {})
}
