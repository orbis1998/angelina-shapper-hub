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
      deliveries: {
        Row: {
          client_address: string
          client_name: string
          client_phone: string | null
          created_at: string
          delivered_at: string
          delivery_fee_cdf: number
          discount_amount: number
          id: string
          livreur_id: string
          notes: string | null
          order_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
          source: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          client_address: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          delivered_at?: string
          delivery_fee_cdf?: number
          discount_amount?: number
          id?: string
          livreur_id: string
          notes?: string | null
          order_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string
          source?: string
          subtotal?: number
          total_amount?: number
        }
        Update: {
          client_address?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          delivered_at?: string
          delivery_fee_cdf?: number
          discount_amount?: number
          id?: string
          livreur_id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string
          source?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          line_total?: number
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      livreur_stock: {
        Row: {
          id: string
          livreur_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          livreur_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          livreur_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "livreur_stock_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livreur_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          sku: string | null
          stock_global: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          sku?: string | null
          stock_global?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sku?: string | null
          stock_global?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          order_number: string
          livreur_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          client_name: string
          client_phone: string | null
          client_address: string
          commune: string
          scheduled_at: string | null
          delivery_fee_cdf: number
          subtotal_usd: number
          discount_amount_usd: number
          total_products_usd: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          notes: string | null
          failure_reason: string | null
          created_by: string | null
          delivery_id: string | null
          stock_reserved: boolean
          created_at: string
          updated_at: string
          delivered_at: string | null
          failed_at: string | null
        }
        Insert: {
          id?: string
          order_number?: string
          livreur_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          client_name: string
          client_phone?: string | null
          client_address: string
          commune: string
          scheduled_at?: string | null
          delivery_fee_cdf?: number
          subtotal_usd?: number
          discount_amount_usd?: number
          total_products_usd?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          failure_reason?: string | null
          created_by?: string | null
          delivery_id?: string | null
          stock_reserved?: boolean
          created_at?: string
          updated_at?: string
          delivered_at?: string | null
          failed_at?: string | null
        }
        Update: {
          id?: string
          order_number?: string
          livreur_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          client_name?: string
          client_phone?: string | null
          client_address?: string
          commune?: string
          scheduled_at?: string | null
          delivery_fee_cdf?: number
          subtotal_usd?: number
          discount_amount_usd?: number
          total_products_usd?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          failure_reason?: string | null
          created_by?: string | null
          delivery_id?: string | null
          stock_reserved?: boolean
          created_at?: string
          updated_at?: string
          delivered_at?: string | null
          failed_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_usd: number
          line_total_usd: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_usd: number
          line_total_usd: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price_usd?: number
          line_total_usd?: number
          created_at?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          id: string
          tracking_code: string
          status: Database["public"]["Enums"]["shipment_status"]
          recipient_name: string
          recipient_phone: string | null
          recipient_address: string | null
          country: string
          city: string
          subtotal_usd: number
          discount_usd: number
          total_usd: number
          shipping_fee_usd: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          shipped_at: string | null
          delivered_at: string | null
        }
        Insert: {
          id?: string
          tracking_code?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          recipient_name: string
          recipient_phone?: string | null
          recipient_address?: string | null
          country: string
          city: string
          subtotal_usd?: number
          discount_usd?: number
          total_usd?: number
          shipping_fee_usd?: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          shipped_at?: string | null
          delivered_at?: string | null
        }
        Update: {
          id?: string
          tracking_code?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          recipient_name?: string
          recipient_phone?: string | null
          recipient_address?: string | null
          country?: string
          city?: string
          subtotal_usd?: number
          discount_usd?: number
          total_usd?: number
          shipping_fee_usd?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          shipped_at?: string | null
          delivered_at?: string | null
        }
        Relationships: []
      }
      shipment_items: {
        Row: {
          id: string
          shipment_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_usd: number
          line_total_usd: number
          created_at: string
        }
        Insert: {
          id?: string
          shipment_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_usd: number
          line_total_usd: number
          created_at?: string
        }
        Update: {
          id?: string
          shipment_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price_usd?: number
          line_total_usd?: number
          created_at?: string
        }
        Relationships: []
      }
      pos_sales: {
        Row: {
          id: string
          sale_number: string
          cashier_id: string
          subtotal_usd: number
          discount_usd: number
          total_usd: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          client_name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sale_number?: string
          cashier_id: string
          subtotal_usd?: number
          discount_usd?: number
          total_usd?: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          client_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sale_number?: string
          cashier_id?: string
          subtotal_usd?: number
          discount_usd?: number
          total_usd?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          client_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      pos_sale_items: {
        Row: {
          id: string
          pos_sale_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_usd: number
          line_total_usd: number
          created_at: string
        }
        Insert: {
          id?: string
          pos_sale_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_usd: number
          line_total_usd: number
          created_at?: string
        }
        Update: {
          id?: string
          pos_sale_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price_usd?: number
          line_total_usd?: number
          created_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          category_id: string
          amount_usd: number
          description: string
          expense_date: string
          receipt_url: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          amount_usd: number
          description: string
          expense_date: string
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          amount_usd?: number
          description?: string
          expense_date?: string
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          badge_number: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          badge_number?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          badge_number?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_allocations: {
        Row: {
          allocated_by: string | null
          created_at: string
          id: string
          livreur_id: string
          notes: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          allocated_by?: string | null
          created_at?: string
          id?: string
          livreur_id: string
          notes?: string | null
          product_id: string
          quantity: number
        }
        Update: {
          allocated_by?: string | null
          created_at?: string
          id?: string
          livreur_id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_allocations_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reserve_order_stock: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      restore_order_stock: {
        Args: { p_order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "livreur"
      order_status: "pending" | "assigned" | "en_route" | "delivered" | "failed" | "cancelled"
      payment_method: "cash" | "mobile_money" | "bank_transfer"
      shipment_status: "preparing" | "shipped" | "in_transit" | "delivered" | "failed"
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
      app_role: ["admin", "livreur"],
      order_status: ["pending", "assigned", "en_route", "delivered", "failed", "cancelled"],
      payment_method: ["cash", "mobile_money", "bank_transfer"],
      shipment_status: ["preparing", "shipped", "in_transit", "delivered", "failed"],
    },
  },
} as const
