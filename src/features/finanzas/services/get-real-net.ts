import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { FLEX_BONUS_DESCRIPTION, HAPPY_BUY_COLLECTOR_ID } from './parse-payment'

export interface RealNetPeriod {
  /** Suma de lo que ML realmente depositó por estas ventas. Es la autoridad. */
  netFromMl: number
  grossSales: number
  mlCommission: number
  shippingCost: number
  /** Retenciones REALES del periodo (fuente + ICA + IVA, las que apliquen). */
  taxWithholding: number
  /**
   * Diferencia entre `bruto − (comisión + envío + retenciones)` y el neto real.
   * Casi siempre 0. Existe porque ML a veces LISTA cargos que no descuenta de
   * ese pago (los cobra en la factura mensual) — sin esta fila el desglose no
   * cuadraría con el total y parecería un error de cálculo.
   */
  otherMlCharges: number
  /** Bonificaciones Flex del periodo. Dinero que ENTRA. */
  shippingBonus: number
  /** Órdenes que ya tienen su pago sincronizado. El resto va por el cálculo viejo. */
  ordersWithPayment: Set<string>
}

const EMPTY: RealNetPeriod = {
  netFromMl: 0,
  grossSales: 0,
  mlCommission: 0,
  shippingCost: 0,
  taxWithholding: 0,
  otherMlCharges: 0,
  shippingBonus: 0,
  ordersWithPayment: new Set(),
}

/**
 * Lo que Mercado Libre realmente pagó por un conjunto de órdenes.
 *
 * Reemplaza tres cálculos que antes hacíamos a mano —comisión, envío y
 * retenciones— por lo que ML reporta. El más importante es el tercero: se
 * estimaba 1,5% sobre TODA venta, y medido sobre 1.209 ventas reales
 * (2026-08-18) resulta que **4 de cada 10 no pagan retención**. La estimación
 * cobraba $1.464.097 al año donde lo real fueron $1.063.362.
 *
 * Solo cuenta pagos `approved`: de 1.441 pagos de la cuenta, 154 son rechazados,
 * cancelados o reembolsados y no representan plata que haya entrado.
 */
export async function getRealNet(
  orderIds: string[],
  from: Date,
  to: Date
): Promise<RealNetPeriod> {
  if (orderIds.length === 0) return { ...EMPTY, ordersWithPayment: new Set() }

  const supabase = createAdminClient()

  const [{ data: sales }, { data: bonuses }] = await Promise.all([
    supabase
      .from('ml_payments')
      .select('order_id, transaction_amount, net_received_amount, meli_fee, shipping_charge, tax_withholding')
      .in('order_id', orderIds)
      .eq('collector_id', HAPPY_BUY_COLLECTOR_ID)
      .eq('status', 'approved'),
    // Las bonificaciones Flex no traen order_id — solo se pueden acotar por fecha.
    supabase
      .from('ml_payments')
      .select('transaction_amount')
      .eq('description', FLEX_BONUS_DESCRIPTION)
      .eq('status', 'approved')
      .gte('date_approved', from.toISOString())
      .lt('date_approved', to.toISOString()),
  ])

  const result: RealNetPeriod = { ...EMPTY, ordersWithPayment: new Set<string>() }

  for (const row of sales ?? []) {
    result.netFromMl += Number(row.net_received_amount)
    result.grossSales += Number(row.transaction_amount)
    result.mlCommission += Number(row.meli_fee)
    result.shippingCost += Number(row.shipping_charge)
    result.taxWithholding += Number(row.tax_withholding)
    if (row.order_id) result.ordersWithPayment.add(row.order_id)
  }

  result.shippingBonus = (bonuses ?? []).reduce((sum, b) => sum + Number(b.transaction_amount), 0)

  // Lo que el desglose no explica. Redondeado porque son pesos con centavos.
  const explained = result.grossSales - result.mlCommission - result.shippingCost - result.taxWithholding
  result.otherMlCharges = Math.round((explained - result.netFromMl) * 100) / 100

  return result
}
