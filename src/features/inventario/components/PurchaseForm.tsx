'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPurchase, updatePurchase, receivePurchase, type PurchaseInput } from '../services/purchase-actions'
import { NEW_PRODUCT } from '../constants'
import { formatCOP } from '@/shared/utils/format'
import { ProductThumbnail } from './ProductThumbnail'
import type { PaymentMethod, Product, Purchase, Warehouse } from '@/types/database'

const KNOWN_PLATFORMS = ['Amazon', 'Alibaba', 'iHerb']

/** Label + input, siempre en el mismo par — así ningún campo del formulario queda sin etiqueta. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  )
}

export function PurchaseForm({
  products,
  warehouses,
  paymentMethods,
  photos,
  purchase,
  onDone,
}: {
  products: Product[]
  warehouses: Warehouse[]
  paymentMethods: PaymentMethod[]
  photos: Record<string, string>
  purchase?: Purchase
  onDone?: () => void
}) {
  const router = useRouter()
  const isEditing = Boolean(purchase)
  const startedWithKnownPlatform = purchase ? KNOWN_PLATFORMS.includes(purchase.platform) : false

  const [productId, setProductId] = useState(purchase?.product_id ?? products[0]?.id ?? '')
  const [newProductName, setNewProductName] = useState('')
  const [platformChoice, setPlatformChoice] = useState(
    !purchase ? KNOWN_PLATFORMS[0] : startedWithKnownPlatform ? purchase.platform : 'Otro'
  )
  const [customPlatform, setCustomPlatform] = useState(purchase && !startedWithKnownPlatform ? purchase.platform : '')
  const [quantity, setQuantity] = useState(purchase ? String(purchase.quantity) : '')
  const [totalCost, setTotalCost] = useState(purchase ? String(purchase.total_cost) : '')
  const [otherCost, setOtherCost] = useState(purchase ? String(purchase.other_cost) : '')
  const [otherCostNote, setOtherCostNote] = useState(purchase?.other_cost_note ?? '')
  const [purchaseDate, setPurchaseDate] = useState(
    purchase ? purchase.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [eta, setEta] = useState(purchase?.eta ?? '')
  const [warehouseId, setWarehouseId] = useState(purchase?.warehouse_id ?? '')
  const [paymentMethodId, setPaymentMethodId] = useState(purchase?.payment_method_id ?? paymentMethods[0]?.id ?? '')
  const [paid, setPaid] = useState(purchase?.paid ?? true)
  const [receiveWarehouseId, setReceiveWarehouseId] = useState(purchase?.warehouse_id || warehouses[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const unitCost = (() => {
    const q = Number(quantity)
    if (!q) return null
    return (Number(totalCost || 0) + Number(otherCost || 0)) / q
  })()

  function buildInput(): PurchaseInput {
    return {
      productId,
      newProductName: productId === NEW_PRODUCT ? newProductName : undefined,
      platform: platformChoice === 'Otro' ? customPlatform : platformChoice,
      quantity: Number(quantity),
      totalCost: Number(totalCost),
      otherCost: Number(otherCost || 0),
      otherCostNote: otherCostNote || undefined,
      purchaseDate,
      eta: eta || undefined,
      warehouseId: warehouseId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      paid,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const input = buildInput()
    const result = isEditing ? await updatePurchase(purchase!.id, input) : await createPurchase(input)
    setSaving(false)

    if (result?.error) {
      setMessage({ kind: 'error', text: result.error })
      return
    }

    setMessage({ kind: 'ok', text: isEditing ? 'Compra actualizada.' : 'Compra registrada.' })
    router.refresh()
    if (!isEditing) {
      setQuantity('')
      setTotalCost('')
      setOtherCost('')
      setOtherCostNote('')
      setPurchaseDate(new Date().toISOString().slice(0, 10))
      setEta('')
      setPaid(true)
      setNewProductName('')
      // Si se creó un producto nuevo, el selector queda apuntando a él (no
      // en "Otro") — si no, la próxima compra del mismo producto crearía
      // un duplicado en vez de reusar el que ya existe.
      if ('productId' in result && typeof result.productId === 'string') setProductId(result.productId)
    }
    onDone?.()
  }

  async function handleReceive() {
    if (!purchase) return
    setReceiving(true)
    setMessage(null)
    const result = await receivePurchase(purchase.id, receiveWarehouseId)
    setReceiving(false)

    if (result?.error) {
      setMessage({ kind: 'error', text: result.error })
      return
    }
    setMessage({ kind: 'ok', text: 'Compra marcada como recibida — el stock ya se actualizó.' })
    router.refresh()
    // No cerramos el panel aquí a propósito: si se cierra de inmediato el
    // mensaje de confirmación casi no se alcanza a leer, y eso fue lo que
    // llevó a un doble registro real (la misma compra agregada dos veces
    // porque no quedó claro que la primera sí había funcionado).
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700">{isEditing ? 'Editar compra' : 'Nueva compra'}</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Producto">
            <div className="flex items-center gap-2">
              {productId !== NEW_PRODUCT && <ProductThumbnail src={photos[productId]} alt="" />}
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.short_name}
                  </option>
                ))}
                {!isEditing && <option value={NEW_PRODUCT}>Otro (producto nuevo)</option>}
              </select>
            </div>
            {productId === NEW_PRODUCT && (
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Nombre del producto"
                className="mt-1.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            )}
          </Field>

          <Field label="Plataforma">
            <select
              value={platformChoice}
              onChange={(e) => setPlatformChoice(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {KNOWN_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="Otro">Otro</option>
            </select>
            {platformChoice === 'Otro' && (
              <input
                type="text"
                value={customPlatform}
                onChange={(e) => setCustomPlatform(e.target.value)}
                placeholder="¿Cuál?"
                className="mt-1.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            )}
          </Field>

          <Field label="Fecha de compra">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Bodega destino">
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Sin definir</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Unidades">
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Valor de la compra (COP)">
            <input
              type="number"
              min="0"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Otros gastos (COP)">
            <input
              type="number"
              min="0"
              value={otherCost}
              onChange={(e) => setOtherCost(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="¿De qué es? (envío, impuestos...)">
            <input
              type="text"
              value={otherCostNote}
              onChange={(e) => setOtherCostNote(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Fecha estimada de entrega">
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>

          <Field label="Método de pago">
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Sin definir</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado de pago">
            <label className="flex h-[34px] items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
              {paid ? 'Pagado' : 'Se debe'}
            </label>
          </Field>

          <Field label="Costo por unidad">
            <p className={`flex h-[34px] items-center text-sm font-semibold ${unitCost !== null ? 'text-gray-900' : 'text-gray-300'}`}>
              {unitCost !== null ? formatCOP(unitCost) : '—'}
            </p>
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-happy-green px-3 py-1.5 text-sm text-white hover:bg-happy-greenDark disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar compra'}
          </button>
        </div>
      </form>

      {isEditing && purchase!.status === 'pedido' && (
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
          <select
            value={receiveWarehouseId}
            onChange={(e) => setReceiveWarehouseId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleReceive}
            disabled={receiving}
            className="rounded-md bg-happy-greenDark px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {receiving ? 'Marcando...' : 'Marcar como recibida'}
          </button>
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.kind === 'ok' ? 'text-happy-greenDark' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  )
}
