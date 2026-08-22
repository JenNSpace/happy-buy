export type UserRole = 'admin' | 'bodega'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  warehouse_id: string | null
  created_at: string
  updated_at: string
}

export interface Warehouse {
  id: string
  name: string
  fee_per_package_flex: number
  fee_per_package_agencia: number
  created_at: string
}

export interface Shipment {
  id: number
  order_id: number
  warehouse_id: string | null
  delivered_at: string | null
  delivered_by: string | null
  /** 'flex' | 'full' | 'mercado_envios' | 'other' — ver getFulfillmentType(). Null en envíos de antes de este campo. */
  fulfillment_type: string | null
  created_at: string
}

export interface Goal {
  id: string
  metric: string
  target_amount: number
  updated_at: string
  updated_by: string | null
}

export interface AdsDailySnapshot {
  id: string
  snapshot_date: string
  campaign_name: string
  budget: number
  roas_target: number
  clicks: number
  cost: number
  total_amount: number
  roas: number
  created_at: string
}

export interface Product {
  id: string
  code: string
  name: string
  short_name: string
  base_unit: string
  active: boolean
  created_at: string
}

export interface ProductListing {
  ml_item_id: string
  user_product_id: string
  product_id: string
  units_per_sale: number
  auto_mapped: boolean
  created_at: string
}

export type InventoryMovementType = 'entrada_compra' | 'salida_venta' | 'ajuste'

export interface InventoryMovement {
  id: string
  product_id: string
  warehouse_id: string
  qty: number
  type: InventoryMovementType
  shipment_id: number | null
  purchase_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export interface StockByWarehouseRow {
  product_id: string
  warehouse_id: string
  stock: number
}

export type PurchaseStatus = 'pedido' | 'recibido'

export type PaymentMethodKind = 'credito' | 'debito' | 'efectivo'

export interface PaymentMethod {
  id: string
  name: string
  kind: PaymentMethodKind | null
  /** Cupo total. Null = no registrado; la UI oculta la barra en vez de inventarlo. */
  credit_limit: number | null
  /** Día del mes en que corta la tarjeta. */
  statement_day: number | null
  /** Día del mes en que vence el pago. */
  due_day: number | null
  created_at: string
}

/** payout = retiro al banco · purchase = compra pagada desde MP · advance_fee = costo de adelantar la plata. */
export type MpMovementKind = 'payout' | 'purchase' | 'advance_fee'

/**
 * Una salida de plata de Mercado Pago, del Reporte de Liberaciones.
 *
 * `id` es el SOURCE_ID del reporte. El sync hace upsert contra él, así que
 * reprocesar el mismo archivo no duplica nada.
 */
export interface MpMovement {
  id: string
  moved_on: string
  kind: MpMovementKind
  amount: number
  payment_method: string | null
  raw_description: string
  synced_at: string
}

export type MpCategory = 'producto' | 'bodegas' | 'insumos' | 'publicidad' | 'personal' | 'otro'

/** Un pedazo de un retiro, ya explicado: "$10.000 en etiquetas". */
export interface MpAllocation {
  id: string
  movement_id: string
  amount: number
  category: MpCategory
  note: string | null
  /** Compra ya registrada en /compras. Si está puesta, este costo YA existe en el sistema. */
  purchase_id: string | null
  /** Pago a bodega ya registrado en /logistica. Igual: el costo ya se contó al despachar. */
  warehouse_payment_id: string | null
  /** Gasto que ESTE reparto creó. Se borra junto con él. */
  expense_id: string | null
  created_by: string | null
  created_at: string
}

export interface Expense {
  id: string
  category: string
  description: string | null
  amount: number
  spent_on: string
  payment_method_id: string | null
  /** Bodega relacionada. Qué significa depende de `is_reimbursement`. */
  warehouse_id: string | null
  /** true = se le devolvió la plata a la bodega; false = se compró y se le envió. */
  is_reimbursement: boolean
  created_by: string | null
  created_at: string
}

export interface Purchase {
  id: string
  product_id: string
  platform: string
  quantity: number
  total_cost: number
  other_cost: number
  other_cost_note: string | null
  eta: string | null
  status: PurchaseStatus
  warehouse_id: string | null
  payment_method_id: string | null
  paid: boolean
  received_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type MoneyReleaseStatus = 'pending' | 'released'

/**
 * Espejo local de un pago de Mercado Pago (`api.mercadopago.com/v1/payments`,
 * mismo token que ML). Solo lo escribe el sync con service-role.
 *
 * `net_received_amount` es la plata que REALMENTE queda de la venta: ML ya le
 * restó comisión, envío y retenciones. Verificado 2026-08-18 en 4 pedidos:
 * `transaction_amount − Σ charges(from: collector) = net_received_amount`
 * cuadra al centavo.
 */
export interface MlPayment {
  id: number
  /** Null en las bonificaciones Flex, que llegan como pagos sueltos. */
  order_id: string | null
  /**
   * Quién COBRA. Si no es el ID de Happy Buy, el pago es una COMPRA que hizo
   * Jen (la API devuelve ambas cosas mezcladas) y no debe contarse como venta.
   */
  collector_id: number | null
  /** 'regular_payment' (una venta) | 'money_transfer' (bonificación Flex). */
  operation_type: string
  /** 'bonificaciones_flex_fc' identifica el bono de envío Flex. */
  description: string | null
  status: string
  date_approved: string | null
  /** Fecha real del depósito. El plazo NO es fijo — nunca hardcodearlo. */
  money_release_date: string | null
  money_release_status: MoneyReleaseStatus | null
  transaction_amount: number
  net_received_amount: number
  meli_fee: number
  shipping_charge: number
  /** Retención en la fuente (1,5%) + ICA Bogotá (0,414%). No todos los pedidos las llevan. */
  tax_withholding: number
  /** Desglose crudo de `charges_details`, para no perder cargos que ML invente después. */
  charges: unknown
  synced_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      goals: {
        Row: Goal
        Insert: Omit<Goal, 'id' | 'updated_at'> & { id?: string; updated_at?: string }
        Update: Partial<Omit<Goal, 'id'>>
      }
      ads_daily_snapshots: {
        Row: AdsDailySnapshot
        Insert: Omit<AdsDailySnapshot, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<AdsDailySnapshot, 'id'>>
      }
      warehouses: {
        Row: Warehouse
        Insert: Omit<Warehouse, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Warehouse, 'id'>>
      }
      shipments: {
        Row: Shipment
        Insert: Omit<Shipment, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Shipment, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Product, 'id'>>
      }
      product_listings: {
        Row: ProductListing
        Insert: Omit<ProductListing, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<ProductListing, 'ml_item_id'>>
      }
      inventory_movements: {
        Row: InventoryMovement
        Insert: Omit<InventoryMovement, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<InventoryMovement, 'id'>>
      }
      purchases: {
        Row: Purchase
        Insert: Omit<Purchase, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<Purchase, 'id'>>
      }
      payment_methods: {
        Row: PaymentMethod
        Insert: Omit<PaymentMethod, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<PaymentMethod, 'id'>>
      }
      ml_payments: {
        Row: MlPayment
        Insert: Omit<MlPayment, 'synced_at'> & { synced_at?: string }
        Update: Partial<Omit<MlPayment, 'id'>>
      }
      mp_movements: {
        Row: MpMovement
        Insert: Omit<MpMovement, 'synced_at'> & { synced_at?: string }
        Update: Partial<Omit<MpMovement, 'id'>>
      }
      mp_allocations: {
        Row: MpAllocation
        Insert: Omit<MpAllocation, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<MpAllocation, 'id'>>
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Expense, 'id'>>
      }
    }
  }
}
