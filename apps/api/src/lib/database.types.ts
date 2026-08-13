// GENERATED via Supabase MCP (`generate_typescript_types`) against the live
// Dent Di project (eafeskigfcinnwahjiyx). Do not hand-edit — regenerate
// after any schema change (db/tenant-schema.sql or a live migration) by
// re-running the same MCP call and overwriting this file.
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_member_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_verification_tokens: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_verification_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          consent_given_at: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          idempotency_key: string | null
          locale: string
          patient_id: string
          sent_to_accounting_at: string | null
          service_id: string
          source: string
          staff_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          consent_given_at?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          idempotency_key?: string | null
          locale: string
          patient_id: string
          sent_to_accounting_at?: string | null
          service_id: string
          source?: string
          staff_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          consent_given_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          idempotency_key?: string | null
          locale?: string
          patient_id?: string
          sent_to_accounting_at?: string | null
          service_id?: string
          source?: string
          staff_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          opens_at: string | null
          staff_id: string | null
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          staff_id?: string | null
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          role_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          role_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          role_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          currency: string
          default_locale: string
          is_singleton: boolean
          name: string
          site_config: Json
          slug: string
          status: string
          supported_locales: string[]
          theme_tokens: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          default_locale?: string
          is_singleton?: boolean
          name: string
          site_config?: Json
          slug: string
          status?: string
          supported_locales?: string[]
          theme_tokens?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          default_locale?: string
          is_singleton?: boolean
          name?: string
          site_config?: Json
          slug?: string
          status?: string
          supported_locales?: string[]
          theme_tokens?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      closures: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          is_recurring_yearly: boolean
          reason: string | null
          staff_id: string | null
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          is_recurring_yearly?: boolean
          reason?: string | null
          staff_id?: string | null
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          is_recurring_yearly?: boolean
          reason?: string | null
          staff_id?: string | null
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "closures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      external_busy_blocks: {
        Row: {
          created_at: string
          ends_at: string
          external_event_id: string | null
          id: string
          source: string
          staff_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          external_event_id?: string | null
          id?: string
          source: string
          staff_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          external_event_id?: string | null
          id?: string
          source?: string
          staff_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_busy_blocks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          booking_id: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          locale: string
          provider_message_id: string | null
          status: string
          template: string
        }
        Insert: {
          booking_id?: string | null
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          locale: string
          provider_message_id?: string | null
          status?: string
          template: string
        }
        Update: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          locale?: string
          provider_message_id?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          consent_given_at: string | null
          created_at: string
          email: string | null
          external_refs: Json
          id: string
          name: string
          notes: string | null
          phone: string | null
          preferred_locale: string | null
          updated_at: string
        }
        Insert: {
          consent_given_at?: string | null
          created_at?: string
          email?: string | null
          external_refs?: Json
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          preferred_locale?: string | null
          updated_at?: string
        }
        Update: {
          consent_given_at?: string | null
          created_at?: string
          email?: string | null
          external_refs?: Json
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_locale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          permissions: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          permissions?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          permissions?: Json
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      services: {
        Row: {
          buffer_minutes_after: number
          buffer_minutes_before: number
          category_id: string | null
          created_at: string
          display_order: number
          duration_minutes: number
          external_refs: Json
          id: string
          is_active: boolean
          price_amount: number | null
          price_currency: string
          price_prefix: string
          updated_at: string
        }
        Insert: {
          buffer_minutes_after?: number
          buffer_minutes_before?: number
          category_id?: string | null
          created_at?: string
          display_order?: number
          duration_minutes: number
          external_refs?: Json
          id?: string
          is_active?: boolean
          price_amount?: number | null
          price_currency?: string
          price_prefix?: string
          updated_at?: string
        }
        Update: {
          buffer_minutes_after?: number
          buffer_minutes_before?: number
          category_id?: string | null
          created_at?: string
          display_order?: number
          duration_minutes?: number
          external_refs?: Json
          id?: string
          is_active?: boolean
          price_amount?: number | null
          price_currency?: string
          price_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_bookable: boolean
          member_id: string | null
          name: string
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_bookable?: boolean
          member_id?: string | null
          name: string
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_bookable?: boolean
          member_id?: string | null
          name?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_calendar_connections: {
        Row: {
          created_at: string
          external_account_email: string | null
          id: string
          last_synced_at: string | null
          provider: string
          staff_id: string
          sync_status: string
          webhook_channel_id: string | null
        }
        Insert: {
          created_at?: string
          external_account_email?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          staff_id: string
          sync_status?: string
          webhook_channel_id?: string | null
        }
        Update: {
          created_at?: string
          external_account_email?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          staff_id?: string
          sync_status?: string
          webhook_channel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_calendar_connections_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          service_id: string
          staff_id: string
        }
        Insert: {
          service_id: string
          staff_id: string
        }
        Update: {
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          created_at: string
          credentials_encrypted: string | null
          id: string
          last_synced_at: string | null
          provider: string
          status: string
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          entity_id: string | null
          entity_type: string
          field: string
          id: string
          locale: string
          updated_at: string
          value: string
        }
        Insert: {
          entity_id?: string | null
          entity_type: string
          field: string
          id?: string
          locale: string
          updated_at?: string
          value: string
        }
        Update: {
          entity_id?: string | null
          entity_type?: string
          field?: string
          id?: string
          locale?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_member: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
