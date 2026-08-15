'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { NEW_PRODUCT } from '../constants'

export interface PurchaseInput {
  productId: string
  newProductName?: string // solo cuando productId === NEW_PRODUCT
  platform: string
  quantity: number
  totalCost: number
  otherCost: number
  otherCostNote?: string
  purchaseDate: string // fecha en que se hizo el pedido, YYYY-MM-DD
  eta?: string
  warehouseId?: string // bodega destino prevista — puede confirmarse/cambiarse al recibir
  paymentMethodId?: string
  paid: boolean
}

function validate(input: PurchaseInput): string | null {
  if (!input.productId || !input.platform.trim()) return 'Falta producto o plataforma'
  if (input.productId === NEW_PRODUCT && !input.newProductName?.trim()) return 'Escribe el nombre del producto nuevo'
  if (!input.quantity || input.quantity <= 0) return 'Las unidades deben ser mayor a cero'
  if (input.totalCost < 0 || input.otherCost < 0) return 'Los valores no pueden ser negativos'
  if (!input.purchaseDate) return 'Falta la fecha de compra'
  return null
}

/** Código interno único derivado del nombre — el usuario nunca lo ve ni lo escribe. */
function slugCode(name: string): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos (á→a) antes de generar el codigo
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'PROD'
  return base
}

async function resolveProductId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PurchaseInput
): Promise<{ productId: string } | { error: string }> {
  if (input.productId !== NEW_PRODUCT) return { productId: input.productId }

  const name = input.newProductName!.trim()
  const code = slugCode(name)

  const { data: product, error } = await supabase
    .from('products')
    .insert({ code, name, short_name: name, base_unit: 'unidad' })
    .select('id')
    .single()

  if (!error) return { productId: product.id }

  // Choque de código (nombre ya usado antes) — reintenta una vez con sufijo.
  if (error.code === '23505') {
    const { data: retryProduct, error: retryError } = await supabase
      .from('products')
      .insert({ code: `${code}_${Date.now().toString(36).slice(-4)}`, name, short_name: name, base_unit: 'unidad' })
      .select('id')
      .single()
    if (retryError) return { error: `No se pudo crear el producto: ${retryError.message}` }
    return { productId: retryProduct.id }
  }

  return { error: `No se pudo crear el producto: ${error.message}` }
}

export async function createPurchase(input: PurchaseInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const validationError = validate(input)
  if (validationError) return { error: validationError }

  const resolved = await resolveProductId(supabase, input)
  if ('error' in resolved) return { error: resolved.error }

  const { error } = await supabase.from('purchases').insert({
    product_id: resolved.productId,
    platform: input.platform.trim(),
    quantity: input.quantity,
    total_cost: input.totalCost,
    other_cost: input.otherCost,
    other_cost_note: input.otherCostNote || null,
    eta: input.eta || null,
    warehouse_id: input.warehouseId || null,
    payment_method_id: input.paymentMethodId || null,
    paid: input.paid,
    status: 'pedido',
    created_by: user.id,
    created_at: new Date(input.purchaseDate).toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath('/compras')
  return { success: true, productId: resolved.productId }
}

export async function updatePurchase(purchaseId: string, input: PurchaseInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const validationError = validate(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('purchases')
    .update({
      product_id: input.productId,
      platform: input.platform.trim(),
      quantity: input.quantity,
      total_cost: input.totalCost,
      other_cost: input.otherCost,
      other_cost_note: input.otherCostNote || null,
      eta: input.eta || null,
      warehouse_id: input.warehouseId || null,
      payment_method_id: input.paymentMethodId || null,
      paid: input.paid,
      created_at: new Date(input.purchaseDate).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', purchaseId)

  if (error) return { error: error.message }

  revalidatePath('/compras')
  return { success: true }
}

/**
 * The only moment a purchase actually touches inventory — before this, it's
 * just a paper record ("viene en camino"). Guarded by `.eq('status', 'pedido')`
 * so a double-click (or two tabs) can't both win: only the first receive
 * flips the row and returns data, the second finds nothing to update and
 * skips the movement insert instead of double-crediting stock.
 */
export async function receivePurchase(purchaseId: string, warehouseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (!warehouseId) return { error: 'Elige a qué bodega llegó' }

  const { data: purchase, error: updateError } = await supabase
    .from('purchases')
    .update({
      status: 'recibido',
      warehouse_id: warehouseId,
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', purchaseId)
    .eq('status', 'pedido')
    .select('id, product_id, quantity')
    .single()

  if (updateError) return { error: 'Esta compra ya estaba marcada como recibida.' }

  const { error: movementError } = await supabase.from('inventory_movements').insert({
    product_id: purchase.product_id,
    warehouse_id: warehouseId,
    qty: purchase.quantity,
    type: 'entrada_compra',
    purchase_id: purchase.id,
    created_by: user.id,
  })

  if (movementError) return { error: movementError.message }

  revalidatePath('/compras')
  return { success: true }
}
