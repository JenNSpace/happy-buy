export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  metric: string
  target_amount: number
  updated_at: string
  updated_by: string | null
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
    }
  }
}
