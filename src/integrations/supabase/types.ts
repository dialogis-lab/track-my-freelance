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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_street: string | null
          archived: boolean
          company_name: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string | null
          user_id: string
          vat_id: string | null
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          archived?: boolean
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
          user_id: string
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          archived?: boolean
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
          user_id?: string
          vat_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          billable: boolean
          category: string | null
          client_id: string | null
          created_at: string
          currency: string
          description: string | null
          gross_amount_cents: number
          id: string
          net_amount_cents: number
          project_id: string
          quantity: number
          receipt_url: string | null
          reimbursable: boolean
          spent_on: string
          unit_amount_cents: number
          updated_at: string
          user_id: string
          vat_amount_cents: number
          vat_rate: number
          vendor: string | null
        }
        Insert: {
          billable?: boolean
          category?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gross_amount_cents?: number
          id?: string
          net_amount_cents?: number
          project_id: string
          quantity?: number
          receipt_url?: string | null
          reimbursable?: boolean
          spent_on?: string
          unit_amount_cents?: number
          updated_at?: string
          user_id: string
          vat_amount_cents?: number
          vat_rate?: number
          vendor?: string | null
        }
        Update: {
          billable?: boolean
          category?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gross_amount_cents?: number
          id?: string
          net_amount_cents?: number
          project_id?: string
          quantity?: number
          receipt_url?: string | null
          reimbursable?: boolean
          spent_on?: string
          unit_amount_cents?: number
          updated_at?: string
          user_id?: string
          vat_amount_cents?: number
          vat_rate?: number
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_expenses_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_stats: {
        Row: {
          created_at: string
          current_streak: number
          date: string
          focus_minutes: number
          id: string
          longest_streak: number
          sessions: number
          sessions_today: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          date?: string
          focus_minutes?: number
          id?: string
          longest_streak?: number
          sessions?: number
          sessions_today?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          date?: string
          focus_minutes?: number
          id?: string
          longest_streak?: number
          sessions?: number
          sessions_today?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount_minor: number
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          minutes: number
          project_id: string | null
          rate_minor: number
        }
        Insert: {
          amount_minor?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          minutes?: number
          project_id?: string | null
          rate_minor?: number
        }
        Update: {
          amount_minor?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          minutes?: number
          project_id?: string | null
          rate_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_seq: {
        Row: {
          id: number
          last_number: number
        }
        Insert: {
          id?: number
          last_number?: number
        }
        Update: {
          id?: number
          last_number?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          issue_date: string | null
          number: string | null
          project_ids: string[]
          status: string
          total_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string | null
          number?: string | null
          project_ids?: string[]
          status?: string
          total_minor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string | null
          number?: string | null
          project_ids?: string[]
          status?: string
          total_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      mfa_rate_limits: {
        Row: {
          attempts: number
          created_at: string
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      mfa_trusted_devices: {
        Row: {
          created_at: string
          device_hash: string
          device_name: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          device_name?: string | null
          expires_at: string
          id?: string
          last_used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          device_name?: string | null
          expires_at?: string
          id?: string
          last_used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pomodoro_sessions: {
        Row: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string | null
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          cycle_in_round?: number
          elapsed_ms?: number
          expected_end_at?: string | null
          id?: string
          phase: string
          phase_index?: number
          revised_at?: string
          started_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          cycle_in_round?: number
          elapsed_ms?: number
          expected_end_at?: string | null
          id?: string
          phase?: string
          phase_index?: number
          revised_at?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pomodoro_settings: {
        Row: {
          auto_advance: boolean
          auto_start_on_mode_switch: boolean
          couple_with_stopwatch_default: boolean
          desktop_notifications: boolean
          focus_ms: number
          long_break_every: number
          long_break_ms: number
          preferred_timer_mode: string | null
          revised_at: string
          short_break_ms: number
          sound_on: boolean
          user_id: string
        }
        Insert: {
          auto_advance?: boolean
          auto_start_on_mode_switch?: boolean
          couple_with_stopwatch_default?: boolean
          desktop_notifications?: boolean
          focus_ms?: number
          long_break_every?: number
          long_break_ms?: number
          preferred_timer_mode?: string | null
          revised_at?: string
          short_break_ms?: number
          sound_on?: boolean
          user_id: string
        }
        Update: {
          auto_advance?: boolean
          auto_start_on_mode_switch?: boolean
          couple_with_stopwatch_default?: boolean
          desktop_notifications?: boolean
          focus_ms?: number
          long_break_every?: number
          long_break_ms?: number
          preferred_timer_mode?: string | null
          revised_at?: string
          short_break_ms?: number
          sound_on?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          bank_details: string | null
          bank_details_enc: Json | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          pomodoro_settings: Json | null
          timer_skin: string
          updated_at: string
          vat_id: string | null
          vat_id_enc: Json | null
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          bank_details_enc?: Json | null
          company_name?: string | null
          created_at?: string
          id: string
          logo_url?: string | null
          pomodoro_settings?: Json | null
          timer_skin?: string
          updated_at?: string
          vat_id?: string | null
          vat_id_enc?: Json | null
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          bank_details_enc?: Json | null
          company_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          pomodoro_settings?: Json | null
          timer_skin?: string
          updated_at?: string
          vat_id?: string | null
          vat_id_enc?: Json | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          client_id: string | null
          created_at: string
          id: string
          name: string
          rate_hour: number | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          rate_hour?: number | null
          user_id: string
        }
        Update: {
          archived?: boolean
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          rate_hour?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          cadence: string
          created_at: string
          enabled: boolean
          hour_local: number
          id: string
          user_id: string
        }
        Insert: {
          cadence: string
          created_at?: string
          enabled?: boolean
          hour_local: number
          id?: string
          user_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          hour_local?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          id: string
          is_private: boolean | null
          minutes_manual: number | null
          notes: string | null
          private_notes_enc: Json | null
          project_id: string
          started_at: string
          stopped_at: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_private?: boolean | null
          minutes_manual?: number | null
          notes?: string | null
          private_notes_enc?: Json | null
          project_id: string
          started_at: string
          stopped_at?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_private?: boolean | null
          minutes_manual?: number | null
          notes?: string | null
          private_notes_enc?: Json | null
          project_id?: string
          started_at?: string
          stopped_at?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_trusted_devices: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_stale_timers: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      expense_calculate_amounts: {
        Args: { p_quantity: number; p_unit_cents: number; p_vat_rate: number }
        Returns: {
          gross_cents: number
          net_cents: number
          vat_cents: number
        }[]
      }
      expense_upsert: {
        Args: {
          p_billable: boolean
          p_category: string
          p_client_id: string
          p_currency: string
          p_description: string
          p_id: string
          p_project_id: string
          p_quantity: number
          p_receipt_url: string
          p_reimbursable: boolean
          p_spent_on: string
          p_unit_amount_cents: number
          p_vat_rate: number
          p_vendor: string
        }
        Returns: {
          billable: boolean
          category: string | null
          client_id: string | null
          created_at: string
          currency: string
          description: string | null
          gross_amount_cents: number
          id: string
          net_amount_cents: number
          project_id: string
          quantity: number
          receipt_url: string | null
          reimbursable: boolean
          spent_on: string
          unit_amount_cents: number
          updated_at: string
          user_id: string
          vat_amount_cents: number
          vat_rate: number
          vendor: string | null
        }
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_admin_invoice_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_new_users_chart: {
        Args: { days?: number }
        Returns: Json
      }
      get_admin_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pomo_get_or_create_session: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      pomo_get_or_init_settings: {
        Args: Record<PropertyKey, never>
        Returns: {
          auto_advance: boolean
          desktop_notifications: boolean
          focus_ms: number
          long_break_every: number
          long_break_ms: number
          revised_at: string
          short_break_ms: number
          sound_on: boolean
          user_id: string
        }[]
      }
      pomo_next: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      pomo_pause: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      pomo_reconcile: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      pomo_resume: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      pomo_start: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      pomo_stop: {
        Args: Record<PropertyKey, never>
        Returns: {
          cycle_in_round: number
          elapsed_ms: number
          expected_end_at: string
          id: string
          phase: string
          phase_index: number
          revised_at: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      server_time: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
