export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      booking_items: {
        Row: {
          booking_id: string
          created_at: string
          event_product_variant_id: string
          id: string
          image_url_snapshot: string | null
          plugo_product_id: string
          plugo_variation_id: string
          product_name_snapshot: string
          quantity: number
          sku_snapshot: string | null
          subtotal: number
          unit_price: number
          variant_name_snapshot: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          event_product_variant_id: string
          id?: string
          image_url_snapshot?: string | null
          plugo_product_id: string
          plugo_variation_id: string
          product_name_snapshot: string
          quantity: number
          sku_snapshot?: string | null
          subtotal: number
          unit_price: number
          variant_name_snapshot: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          event_product_variant_id?: string
          id?: string
          image_url_snapshot?: string | null
          plugo_product_id?: string
          plugo_variation_id?: string
          product_name_snapshot?: string
          quantity?: number
          sku_snapshot?: string | null
          subtotal?: number
          unit_price?: number
          variant_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_event_product_variant_id_fkey"
            columns: ["event_product_variant_id"]
            isOneToOne: false
            referencedRelation: "event_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          arrived_at: string | null
          booking_number: string
          called_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checkout_notes: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_session_id: string
          event_id: string
          expires_at: string
          id: string
          idempotency_key: string
          pos_integration_mode: string | null
          pos_order_number: string | null
          pos_processing_started_at: string | null
          pos_receipt_number: string | null
          pos_transaction_reference: string | null
          queue_number: string
          reserved_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_snapshot: number
          token_hash: string
          total_snapshot: number
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          booking_number: string
          called_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checkout_notes?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_session_id: string
          event_id: string
          expires_at: string
          id?: string
          idempotency_key: string
          pos_integration_mode?: string | null
          pos_order_number?: string | null
          pos_processing_started_at?: string | null
          pos_receipt_number?: string | null
          pos_transaction_reference?: string | null
          queue_number: string
          reserved_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_snapshot?: number
          token_hash: string
          total_snapshot?: number
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          booking_number?: string
          called_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checkout_notes?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_session_id?: string
          event_id?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          pos_integration_mode?: string | null
          pos_order_number?: string | null
          pos_processing_started_at?: string | null
          pos_receipt_number?: string | null
          pos_transaction_reference?: string | null
          queue_number?: string
          reserved_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_snapshot?: number
          token_hash?: string
          total_snapshot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_session_id_fkey"
            columns: ["customer_session_id"]
            isOneToOne: false
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          access_code_id: string | null
          anonymous_token_hash: string
          created_at: string
          customer_name: string | null
          event_id: string
          expires_at: string
          id: string
          phone: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          access_code_id?: string | null
          anonymous_token_hash: string
          created_at?: string
          customer_name?: string | null
          event_id: string
          expires_at: string
          id?: string
          phone?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          access_code_id?: string | null
          anonymous_token_hash?: string
          created_at?: string
          customer_name?: string | null
          event_id?: string
          expires_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "event_access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_access_attempts: {
        Row: {
          attempted_at: string
          event_id: string
          id: string
          ip_hash: string | null
          session_identifier: string | null
          successful: boolean
        }
        Insert: {
          attempted_at?: string
          event_id: string
          id?: string
          ip_hash?: string | null
          session_identifier?: string | null
          successful?: boolean
        }
        Update: {
          attempted_at?: string
          event_id?: string
          id?: string
          ip_hash?: string | null
          session_identifier?: string | null
          successful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_access_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_access_codes: {
        Row: {
          active: boolean
          code_hash: string
          created_at: string
          disabled_at: string | null
          event_id: string
          id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code_hash: string
          created_at?: string
          disabled_at?: string | null
          event_id: string
          id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code_hash?: string
          created_at?: string
          disabled_at?: string | null
          event_id?: string
          id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_access_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_product_variants: {
        Row: {
          color: string | null
          created_at: string
          display_name: string
          enabled: boolean
          event_product_id: string
          id: string
          image_url_snapshot: string | null
          maximum_quantity_per_customer: number | null
          plugo_variation_id: string
          price_snapshot: number
          size: string | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_name: string
          enabled?: boolean
          event_product_id: string
          id?: string
          image_url_snapshot?: string | null
          maximum_quantity_per_customer?: number | null
          plugo_variation_id: string
          price_snapshot: number
          size?: string | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          event_product_id?: string
          id?: string
          image_url_snapshot?: string | null
          maximum_quantity_per_customer?: number | null
          plugo_variation_id?: string
          price_snapshot?: number
          size?: string | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_product_variants_event_product_id_fkey"
            columns: ["event_product_id"]
            isOneToOne: false
            referencedRelation: "event_products"
            referencedColumns: ["id"]
          },
        ]
      }
      event_products: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          enabled: boolean
          event_id: string
          event_note: string | null
          featured: boolean
          id: string
          image_url: string | null
          maximum_quantity_per_customer: number | null
          plugo_product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          enabled?: boolean
          event_id: string
          event_note?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          maximum_quantity_per_customer?: number | null
          plugo_product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          enabled?: boolean
          event_id?: string
          event_note?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          maximum_quantity_per_customer?: number | null
          plugo_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_products_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          arrival_grace_minutes: number
          banner_url: string | null
          created_at: string
          description: string | null
          event_end_at: string
          event_start_at: string
          id: string
          maximum_items_per_customer: number
          name: string
          plugo_location_id: string | null
          plugo_location_name: string | null
          reservation_close_at: string
          reservation_duration_minutes: number
          reservation_open_at: string
          safety_stock_quantity: number
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["event_status"]
          terms_and_conditions: string | null
          updated_at: string
          venue_address: string | null
          venue_name: string
        }
        Insert: {
          arrival_grace_minutes?: number
          banner_url?: string | null
          created_at?: string
          description?: string | null
          event_end_at: string
          event_start_at: string
          id?: string
          maximum_items_per_customer?: number
          name: string
          plugo_location_id?: string | null
          plugo_location_name?: string | null
          reservation_close_at: string
          reservation_duration_minutes?: number
          reservation_open_at: string
          safety_stock_quantity?: number
          seller_id: string
          slug: string
          status?: Database["public"]["Enums"]["event_status"]
          terms_and_conditions?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_name: string
        }
        Update: {
          arrival_grace_minutes?: number
          banner_url?: string | null
          created_at?: string
          description?: string | null
          event_end_at?: string
          event_start_at?: string
          id?: string
          maximum_items_per_customer?: number
          name?: string
          plugo_location_id?: string | null
          plugo_location_name?: string | null
          reservation_close_at?: string
          reservation_duration_minutes?: number
          reservation_open_at?: string
          safety_stock_quantity?: number
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["event_status"]
          terms_and_conditions?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_snapshots: {
        Row: {
          created_at: string
          event_id: string
          id: string
          plugo_location_id: string
          plugo_product_id: string
          plugo_variation_id: string
          quantity: number
          sync_request_id: string | null
          synced_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          plugo_location_id: string
          plugo_product_id: string
          plugo_variation_id: string
          quantity?: number
          sync_request_id?: string | null
          synced_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          plugo_location_id?: string
          plugo_product_id?: string
          plugo_variation_id?: string
          quantity?: number
          sync_request_id?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_tickets: {
        Row: {
          arrived_at: string | null
          booking_id: string
          called_at: string | null
          completed_at: string | null
          created_at: string
          event_id: string
          id: string
          queue_number: string
          sequence_number: number
          serving_at: string | null
          skipped_at: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          booking_id: string
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          queue_number: string
          sequence_number: number
          serving_at?: string | null
          skipped_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          booking_id?: string
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          queue_number?: string
          sequence_number?: number
          serving_at?: string | null
          skipped_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string | null
          name: string
          plugo_vendor_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          plugo_vendor_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          plugo_vendor_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          booking_id: string
          created_at: string
          event_id: string
          event_product_variant_id: string
          id: string
          plugo_variation_id: string
          quantity: number
          release_reason: string | null
          released_at: string | null
          reserved_at: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          event_id: string
          event_product_variant_id: string
          id?: string
          plugo_variation_id: string
          quantity: number
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          event_id?: string
          event_product_variant_id?: string
          id?: string
          plugo_variation_id?: string
          quantity?: number
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_event_product_variant_id_fkey"
            columns: ["event_product_variant_id"]
            isOneToOne: false
            referencedRelation: "event_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      available_stock: {
        Args: { _event_id: string; _variation_id: string }
        Returns: number
      }
      create_local_booking: {
        Args: {
          _customer_session_id: string
          _event_id: string
          _idempotency_key: string
          _items: Json
          _token_hash: string
        }
        Returns: Json
      }
      expire_stale_bookings: { Args: never; Returns: number }
    }
    Enums: {
      booking_status:
        | "draft"
        | "reserved"
        | "queued"
        | "called"
        | "at_cashier"
        | "processing_at_pos"
        | "completed"
        | "expired"
        | "cancelled"
        | "no_show"
        | "failed"
      event_status:
        | "draft"
        | "scheduled"
        | "active"
        | "paused"
        | "closed"
        | "completed"
        | "cancelled"
      queue_status:
        | "waiting"
        | "called"
        | "arrived"
        | "serving"
        | "completed"
        | "skipped"
        | "expired"
      reservation_status: "active" | "released" | "committed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "draft",
        "reserved",
        "queued",
        "called",
        "at_cashier",
        "processing_at_pos",
        "completed",
        "expired",
        "cancelled",
        "no_show",
        "failed",
      ],
      event_status: [
        "draft",
        "scheduled",
        "active",
        "paused",
        "closed",
        "completed",
        "cancelled",
      ],
      queue_status: [
        "waiting",
        "called",
        "arrived",
        "serving",
        "completed",
        "skipped",
        "expired",
      ],
      reservation_status: ["active", "released", "committed"],
    },
  },
} as const
