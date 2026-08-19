'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'happybuy.costModelChange.v1.dismissed'

/**
 * Explains, once, why the profit figures moved.
 *
 * It exists because a number changing without explanation reads as a bug. The
 * jump is real and in her favour: the old model charged an estimated 1,5%
 * withholding to every sale, and 4 in 10 sales pay none at all.
 *
 * Dismissal lives in localStorage — a one-off acknowledgement doesn't deserve a
 * database column, and if she opens the dashboard on another device seeing it
 * again is harmless.
 */
export function CostModelChangeBanner() {
  // Starts hidden: rendering it before reading localStorage would flash the
  // banner at someone who already dismissed it.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) !== '1')
  }, [])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="rounded-xl border border-happy-green/30 bg-happy-green/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Los números cambiaron, y están bien
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Ahora leemos de Mercado Libre lo que te descuenta en cada venta, en vez de
            estimarlo. Resulta que <strong className="font-semibold">4 de cada 10 ventas no pagan
            retención</strong>, y les estábamos cobrando 1,5% igual. Tu ganancia sube porque antes
            estaba subestimada, no porque el negocio haya cambiado.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-sm font-medium text-gray-500 hover:text-happy-greenText"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
