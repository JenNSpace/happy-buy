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

export interface PaymentMethod {
  id: string
  name: string
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
    }
  }
}
