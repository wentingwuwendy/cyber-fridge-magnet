export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      fridges: {
        Row: {
          id: number
          user_id: string
          name: string
          image_url: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          name?: string
          image_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          name?: string
          image_url?: string | null
          created_at?: string | null
        }
      }
      magnets: {
        Row: {
          id: number
          user_id: string
          fridge_id: number | null
          location: string
          note: string | null
          lat: number | null
          lng: number | null
          pos_x: number
          pos_y: number
          scale: number
          image_url: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          fridge_id?: number | null
          location?: string
          note?: string | null
          lat?: number | null
          lng?: number | null
          pos_x?: number
          pos_y?: number
          scale?: number
          image_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          fridge_id?: number | null
          location?: string
          note?: string | null
          lat?: number | null
          lng?: number | null
          pos_x?: number
          pos_y?: number
          scale?: number
          image_url?: string | null
          created_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
