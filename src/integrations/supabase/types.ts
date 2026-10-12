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
      abandoned_carts: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          items: Json
          recovered: boolean
          subtotal_bdt: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          items?: Json
          recovered?: boolean
          subtotal_bdt?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          items?: Json
          recovered?: boolean
          subtotal_bdt?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          district: string | null
          full_name: string
          id: string
          is_default: boolean
          label: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          city: string
          created_at?: string
          district?: string | null
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          district?: string | null
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      carts: {
        Row: {
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          store_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          store_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          min_order_bdt: number
          store_id: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          min_order_bdt?: number
          store_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          min_order_bdt?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_dispatches: {
        Row: {
          cod_amount_bdt: number
          consignment_id: string | null
          courier: string
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          mode: string
          order_id: string
          request_payload: Json
          response_payload: Json | null
          status: string
          tracking_code: string | null
        }
        Insert: {
          cod_amount_bdt?: number
          consignment_id?: string | null
          courier: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          mode?: string
          order_id: string
          request_payload?: Json
          response_payload?: Json | null
          status?: string
          tracking_code?: string | null
        }
        Update: {
          cod_amount_bdt?: number
          consignment_id?: string | null
          courier?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          mode?: string
          order_id?: string
          request_payload?: Json
          response_payload?: Json | null
          status?: string
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty: {
        Row: {
          created_at: string
          points: number
          referral_code: string
          referred_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          points?: number
          referral_code?: string
          referred_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          points?: number
          referral_code?: string
          referred_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          attempts: number
          body: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          provider: string | null
          provider_ref: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string | null
          template: string | null
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string | null
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          qty: number
          unit_price_bdt: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          qty: number
          unit_price_bdt: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          qty?: number
          unit_price_bdt?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string
          city: string
          consignment_id: string | null
          coupon_code: string | null
          courier: string | null
          courier_status: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_note: string | null
          delivery_zone: string
          discount_bdt: number
          dispatched_at: string | null
          district: string | null
          guest_email: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string
          payment_provider: string | null
          payment_ref: string | null
          payment_status: string
          shipped_at: string | null
          shipping_bdt: number
          status: string
          store_id: string | null
          subtotal_bdt: number
          total_bdt: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line: string
          city: string
          consignment_id?: string | null
          coupon_code?: string | null
          courier?: string | null
          courier_status?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_note?: string | null
          delivery_zone?: string
          discount_bdt?: number
          dispatched_at?: string | null
          district?: string | null
          guest_email?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_provider?: string | null
          payment_ref?: string | null
          payment_status?: string
          shipped_at?: string | null
          shipping_bdt?: number
          status?: string
          store_id?: string | null
          subtotal_bdt: number
          total_bdt: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line?: string
          city?: string
          consignment_id?: string | null
          coupon_code?: string | null
          courier?: string | null
          courier_status?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_note?: string | null
          delivery_zone?: string
          discount_bdt?: number
          dispatched_at?: string | null
          district?: string | null
          guest_email?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_provider?: string | null
          payment_ref?: string | null
          payment_status?: string
          shipped_at?: string | null
          shipping_bdt?: number
          status?: string
          store_id?: string | null
          subtotal_bdt?: number
          total_bdt?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          label: string
          option_group: string
          price_delta_bdt: number
          product_id: string
          sort_order: number
          stock: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          option_group?: string
          price_delta_bdt?: number
          product_id: string
          sort_order?: number
          stock?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          option_group?: string
          price_delta_bdt?: number
          product_id?: string
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cod_available: boolean
          compare_price_bdt: number | null
          created_at: string
          delivery_days: string | null
          description: string | null
          flash_price_bdt: number | null
          id: string
          images: string[]
          is_featured: boolean
          is_flash_sale: boolean
          is_new: boolean
          name: string
          price_bdt: number
          rating: number
          review_count: number
          slug: string
          specs: string | null
          stock: number
          store_id: string | null
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          cod_available?: boolean
          compare_price_bdt?: number | null
          created_at?: string
          delivery_days?: string | null
          description?: string | null
          flash_price_bdt?: number | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_flash_sale?: boolean
          is_new?: boolean
          name: string
          price_bdt: number
          rating?: number
          review_count?: number
          slug: string
          specs?: string | null
          stock?: number
          store_id?: string | null
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          cod_available?: boolean
          compare_price_bdt?: number | null
          created_at?: string
          delivery_days?: string | null
          description?: string | null
          flash_price_bdt?: number | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_flash_sale?: boolean
          is_new?: boolean
          name?: string
          price_bdt?: number
          rating?: number
          review_count?: number
          slug?: string
          specs?: string | null
          stock?: number
          store_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          id: string
          images: string[]
          product_id: string
          rating: number
          user_id: string | null
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          id?: string
          images?: string[]
          product_id: string
          rating: number
          user_id?: string | null
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          images?: string[]
          product_id?: string
          rating?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          notified: boolean
          phone: string | null
          product_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          notified?: boolean
          phone?: string | null
          product_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          notified?: boolean
          phone?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accent_color: string
          active: boolean
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
          tagline: string | null
          theme_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
          tagline?: string | null
          theme_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          theme_color?: string
          updated_at?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wishlists: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "customer"
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
    Enums: {
      app_role: ["admin", "customer"],
    },
  },
} as const
