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
      admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          amount: number
          cashback: number
          created_at: string
          id: string
          manual: boolean
          member_id: string
          note: string | null
          order_id: string | null
          points_earned: number
          receipt_url: string | null
          source: string
          table_name: string
        }
        Insert: {
          amount?: number
          cashback?: number
          created_at?: string
          id?: string
          manual?: boolean
          member_id: string
          note?: string | null
          order_id?: string | null
          points_earned?: number
          receipt_url?: string | null
          source: string
          table_name: string
        }
        Update: {
          amount?: number
          cashback?: number
          created_at?: string
          id?: string
          manual?: boolean
          member_id?: string
          note?: string | null
          order_id?: string | null
          points_earned?: number
          receipt_url?: string | null
          source?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_programs: {
        Row: {
          active: boolean
          buy_product_ids: string[]
          free_product_id: string | null
          free_qty: number
          free_variant: string | null
          id: string
          type: string
        }
        Insert: {
          active?: boolean
          buy_product_ids?: string[]
          free_product_id?: string | null
          free_qty?: number
          free_variant?: string | null
          id?: string
          type?: string
        }
        Update: {
          active?: boolean
          buy_product_ids?: string[]
          free_product_id?: string | null
          free_qty?: number
          free_variant?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_programs_free_product_id_fkey"
            columns: ["free_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          birth_day: number | null
          birth_month: number | null
          birthdate: string | null
          created_at: string
          daily_cashback_date: string | null
          daily_cashback_earned: number
          discount_rate: number
          email: string
          ktp: string | null
          last_birthday_email_sent: string | null
          last_room_upgrade: string | null
          monthly_since_upgrade: number
          name: string
          name_lower: string
          phone: string
          redeemable_points: number
          spending_since_upgrade: number
          tax_rate: number
          tier: string
          tier_restored_at: string | null
          upgrade_date: string | null
          user_id: string
          welcomed: boolean
          yearly_since_upgrade: number
        }
        Insert: {
          birth_day?: number | null
          birth_month?: number | null
          birthdate?: string | null
          created_at?: string
          daily_cashback_date?: string | null
          daily_cashback_earned?: number
          discount_rate?: number
          email: string
          ktp?: string | null
          last_birthday_email_sent?: string | null
          last_room_upgrade?: string | null
          monthly_since_upgrade?: number
          name: string
          name_lower?: string
          phone: string
          redeemable_points?: number
          spending_since_upgrade?: number
          tax_rate?: number
          tier?: string
          tier_restored_at?: string | null
          upgrade_date?: string | null
          user_id: string
          welcomed?: boolean
          yearly_since_upgrade?: number
        }
        Update: {
          birth_day?: number | null
          birth_month?: number | null
          birthdate?: string | null
          created_at?: string
          daily_cashback_date?: string | null
          daily_cashback_earned?: number
          discount_rate?: number
          email?: string
          ktp?: string | null
          last_birthday_email_sent?: string | null
          last_room_upgrade?: string | null
          monthly_since_upgrade?: number
          name?: string
          name_lower?: string
          phone?: string
          redeemable_points?: number
          spending_since_upgrade?: number
          tax_rate?: number
          tier?: string
          tier_restored_at?: string | null
          upgrade_date?: string | null
          user_id?: string
          welcomed?: boolean
          yearly_since_upgrade?: number
        }
        Relationships: []
      }
      olsera_token_cache: {
        Row: {
          access_token: string
          expires_at: string
          id: number
          refresh_expires_at: string | null
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          id?: number
          refresh_expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          id?: number
          refresh_expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          order_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          order_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          date: string
          delivery_fee: number
          discount: number
          grand_total: number
          id: string
          is_member: boolean
          items: Json
          loyalty_recorded: boolean
          loyalty_tx_id: string | null
          member_id: string | null
          olsera_order_id: string | null
          payment_method: string
          payment_status: string
          phone: string | null
          proof_url: string | null
          status: string
          subtotal: number
          table_name: string
          tax: number
          total: number
          voucher_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          delivery_fee?: number
          discount?: number
          grand_total?: number
          id?: string
          is_member?: boolean
          items?: Json
          loyalty_recorded?: boolean
          loyalty_tx_id?: string | null
          member_id?: string | null
          olsera_order_id?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          proof_url?: string | null
          status?: string
          subtotal?: number
          table_name: string
          tax?: number
          total?: number
          voucher_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          delivery_fee?: number
          discount?: number
          grand_total?: number
          id?: string
          is_member?: boolean
          items?: Json
          loyalty_recorded?: boolean
          loyalty_tx_id?: string | null
          member_id?: string | null
          olsera_order_id?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          proof_url?: string | null
          status?: string
          subtotal?: number
          table_name?: string
          tax?: number
          total?: number
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          olsera_id: string | null
          photo_1: string | null
          photo_10: string | null
          photo_2: string | null
          photo_3: string | null
          photo_4: string | null
          photo_5: string | null
          photo_6: string | null
          photo_7: string | null
          photo_8: string | null
          photo_9: string | null
          pos_hidden: boolean
          pos_sell_price: number
          updated_at: string
          variant_label: string
          variant_names: string[]
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          olsera_id?: string | null
          photo_1?: string | null
          photo_10?: string | null
          photo_2?: string | null
          photo_3?: string | null
          photo_4?: string | null
          photo_5?: string | null
          photo_6?: string | null
          photo_7?: string | null
          photo_8?: string | null
          photo_9?: string | null
          pos_hidden?: boolean
          pos_sell_price?: number
          updated_at?: string
          variant_label?: string
          variant_names?: string[]
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          olsera_id?: string | null
          photo_1?: string | null
          photo_10?: string | null
          photo_2?: string | null
          photo_3?: string | null
          photo_4?: string | null
          photo_5?: string | null
          photo_6?: string | null
          photo_7?: string | null
          photo_8?: string | null
          photo_9?: string | null
          pos_hidden?: boolean
          pos_sell_price?: number
          updated_at?: string
          variant_label?: string
          variant_names?: string[]
        }
        Relationships: []
      }
      room_upgrades: {
        Row: {
          claimed_at: string
          id: string
          location: string | null
          member_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          location?: string | null
          member_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          location?: string | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_upgrades_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      settings: {
        Row: {
          birthday_gold_cashback_rate: number
          bronze_discount_rate: number
          bronze_to_silver_monthly: number
          bronze_to_silver_yearly: number
          classic_to_bronze_monthly: number
          gold_cashback_rate: number
          gold_daily_cashback_cap: number
          gold_discount_rate: number
          gold_stay_yearly: number
          id: number
          silver_cashback_rate: number
          silver_daily_cashback_cap: number
          silver_discount_rate: number
          silver_stay_yearly: number
          silver_to_gold_monthly: number
          silver_to_gold_yearly: number
          updated_at: string
        }
        Insert: {
          birthday_gold_cashback_rate?: number
          bronze_discount_rate?: number
          bronze_to_silver_monthly?: number
          bronze_to_silver_yearly?: number
          classic_to_bronze_monthly?: number
          gold_cashback_rate?: number
          gold_daily_cashback_cap?: number
          gold_discount_rate?: number
          gold_stay_yearly?: number
          id?: number
          silver_cashback_rate?: number
          silver_daily_cashback_cap?: number
          silver_discount_rate?: number
          silver_stay_yearly?: number
          silver_to_gold_monthly?: number
          silver_to_gold_yearly?: number
          updated_at?: string
        }
        Update: {
          birthday_gold_cashback_rate?: number
          bronze_discount_rate?: number
          bronze_to_silver_monthly?: number
          bronze_to_silver_yearly?: number
          classic_to_bronze_monthly?: number
          gold_cashback_rate?: number
          gold_daily_cashback_cap?: number
          gold_discount_rate?: number
          gold_stay_yearly?: number
          id?: number
          silver_cashback_rate?: number
          silver_daily_cashback_cap?: number
          silver_discount_rate?: number
          silver_stay_yearly?: number
          silver_to_gold_monthly?: number
          silver_to_gold_yearly?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          assigned_location: string
          created_at: string
          user_id: string
        }
        Insert: {
          assigned_location: string
          created_at?: string
          user_id: string
        }
        Update: {
          assigned_location?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_push_tokens: {
        Row: {
          created_at: string
          id: string
          role: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      voucher_redemptions: {
        Row: {
          id: string
          order_id: string | null
          redeemed_at: string
          table_name: string
          voucher_id: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          redeemed_at?: string
          table_name: string
          voucher_id: string
        }
        Update: {
          id?: string
          order_id?: string | null
          redeemed_at?: string
          table_name?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          active: boolean
          code: string
          id: string
          limit_per_day: number
          type: string
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          limit_per_day?: number
          type: string
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          limit_per_day?: number
          type?: string
          value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
