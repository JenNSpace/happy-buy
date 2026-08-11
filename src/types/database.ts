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
  fee_per_package: number
  created_at: string
}

export interface Shipment {
  id: number
  order_id: number
  warehouse_id: string | null
  delivered_at: string | null
  delivered_by: string | null
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
    }
  }
}
