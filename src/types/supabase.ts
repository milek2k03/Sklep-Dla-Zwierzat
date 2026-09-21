export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          user_id: string;
          role: "admin";
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: "admin";
          created_at?: string;
        };
        Update: {
          role?: "admin";
        };
        Relationships: [];
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          percent: number;
          scope_type: "all" | "category" | "product";
          scope_value: string | null;
          time_mode: "permanent" | "scheduled" | "recurring";
          starts_at: string | null;
          ends_at: string | null;
          weekdays: number[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          percent: number;
          scope_type?: "all" | "category" | "product";
          scope_value?: string | null;
          time_mode?: "permanent" | "scheduled" | "recurring";
          starts_at?: string | null;
          ends_at?: string | null;
          weekdays?: number[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          percent?: number;
          scope_type?: "all" | "category" | "product";
          scope_value?: string | null;
          time_mode?: "permanent" | "scheduled" | "recurring";
          starts_at?: string | null;
          ends_at?: string | null;
          weekdays?: number[];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_entries: {
        Row: {
          id: string;
          expense_date: string;
          category:
            | "goods"
            | "packaging"
            | "shipping"
            | "stripe_fee"
            | "refund"
            | "domain"
            | "hosting"
            | "marketing"
            | "other";
          description: string;
          amount: number;
          payment_method: "blik" | "transfer" | "cash" | "cod" | "other";
          vendor: string | null;
          document_number: string | null;
          document_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_date?: string;
          category:
            | "goods"
            | "packaging"
            | "shipping"
            | "stripe_fee"
            | "refund"
            | "domain"
            | "hosting"
            | "marketing"
            | "other";
          description: string;
          amount: number;
          payment_method?: "blik" | "transfer" | "cash" | "cod" | "other";
          vendor?: string | null;
          document_number?: string | null;
          document_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          expense_date?: string;
          category?:
            | "goods"
            | "packaging"
            | "shipping"
            | "stripe_fee"
            | "refund"
            | "domain"
            | "hosting"
            | "marketing"
            | "other";
          description?: string;
          amount?: number;
          payment_method?: "blik" | "transfer" | "cash" | "cod" | "other";
          vendor?: string | null;
          document_number?: string | null;
          document_url?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversion_events: {
        Row: {
          id: string;
          event_type:
            | "page_view"
            | "product_view"
            | "add_to_cart"
            | "checkout_started"
            | "order_created"
            | "order_paid";
          visitor_id: string;
          session_id: string;
          page_path: string | null;
          page_title: string | null;
          referrer: string | null;
          product_slug: string | null;
          product_name: string | null;
          product_category: string | null;
          order_id: string | null;
          order_number: string | null;
          amount: number | null;
          quantity: number | null;
          metadata: Json;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type:
            | "page_view"
            | "product_view"
            | "add_to_cart"
            | "checkout_started"
            | "order_created"
            | "order_paid";
          visitor_id: string;
          session_id: string;
          page_path?: string | null;
          page_title?: string | null;
          referrer?: string | null;
          product_slug?: string | null;
          product_name?: string | null;
          product_category?: string | null;
          order_id?: string | null;
          order_number?: string | null;
          amount?: number | null;
          quantity?: number | null;
          metadata?: Json;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "conversion_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_buckets: {
        Row: {
          rate_key: string;
          count: number;
          reset_at: string;
          updated_at: string;
        };
        Insert: {
          rate_key: string;
          count?: number;
          reset_at: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          reset_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_consents: {
        Row: {
          order_id: string;
          email: string;
          consent_version: string;
          consent_text: string;
          consented_at: string;
        };
        Insert: {
          order_id: string;
          email: string;
          consent_version: string;
          consent_text: string;
          consented_at?: string;
        };
        Update: {
          email?: string;
          consent_version?: string;
          consent_text?: string;
          consented_at?: string;
        };
        Relationships: [];
      };
      marketing_preferences: {
        Row: {
          email: string;
          is_active: boolean;
          last_consented_at: string;
          revoked_at: string | null;
          updated_at: string;
        };
        Insert: {
          email: string;
          is_active?: boolean;
          last_consented_at: string;
          revoked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          is_active?: boolean;
          revoked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_mailings: {
        Row: {
          campaign_key: string;
          email: string;
          status: "claimed" | "sent" | "failed";
          provider_id: string | null;
          attempted_at: string;
          sent_at: string | null;
        };
        Insert: {
          campaign_key: string;
          email: string;
          status?: "claimed" | "sent" | "failed";
          provider_id?: string | null;
          attempted_at?: string;
          sent_at?: string | null;
        };
        Update: {
          status?: "claimed" | "sent" | "failed";
          provider_id?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          status: "new" | "confirmed" | "paid" | "shipped" | "cancelled";
          customer_full_name: string;
          customer_email: string;
          customer_phone: string;
          delivery_method: string;
          delivery_address: string;
          delivery_city: string | null;
          delivery_street: string | null;
          delivery_building_number: string | null;
          delivery_postal_code: string | null;
          delivery_country: string;
          pickup_point: string | null;
          notes: string | null;
          subtotal: number;
          discount_code: string | null;
          discount_total: number;
          delivery_cost: number;
          total: number;
          payment_method: "manual" | "stripe";
          stripe_checkout_session_id: string | null;
          stripe_payment_method_type: string | null;
          stripe_payment_intent_id: string | null;
          stripe_refund_id: string | null;
          refund_total: number;
          refund_products_total: number;
          refund_delivery_total: number;
          paid_at: string | null;
          refunded_at: string | null;
          refund_reason: string | null;
          refund_email_sent_at: string | null;
          stock_restored_at: string | null;
          customer_email_sent_at: string | null;
          admin_email_sent_at: string | null;
          shipping_carrier: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          shipped_at: string | null;
          shipping_email_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          status?: "new" | "confirmed" | "paid" | "shipped" | "cancelled";
          customer_full_name: string;
          customer_email: string;
          customer_phone: string;
          delivery_method: string;
          delivery_address: string;
          delivery_city?: string | null;
          delivery_street?: string | null;
          delivery_building_number?: string | null;
          delivery_postal_code?: string | null;
          delivery_country?: string;
          pickup_point?: string | null;
          notes?: string | null;
          subtotal: number;
          discount_code?: string | null;
          discount_total?: number;
          delivery_cost: number;
          total: number;
          payment_method?: "manual" | "stripe";
          stripe_checkout_session_id?: string | null;
          stripe_payment_method_type?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          refund_total?: number;
          refund_products_total?: number;
          refund_delivery_total?: number;
          paid_at?: string | null;
          refunded_at?: string | null;
          refund_reason?: string | null;
          refund_email_sent_at?: string | null;
          stock_restored_at?: string | null;
          customer_email_sent_at?: string | null;
          admin_email_sent_at?: string | null;
          shipping_carrier?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          shipped_at?: string | null;
          shipping_email_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "new" | "confirmed" | "paid" | "shipped" | "cancelled";
          delivery_city?: string | null;
          delivery_street?: string | null;
          delivery_building_number?: string | null;
          delivery_postal_code?: string | null;
          delivery_country?: string;
          payment_method?: "manual" | "stripe";
          stripe_checkout_session_id?: string | null;
          stripe_payment_method_type?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          refund_total?: number;
          refund_products_total?: number;
          refund_delivery_total?: number;
          paid_at?: string | null;
          refunded_at?: string | null;
          refund_reason?: string | null;
          refund_email_sent_at?: string | null;
          stock_restored_at?: string | null;
          customer_email_sent_at?: string | null;
          admin_email_sent_at?: string | null;
          shipping_carrier?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          shipped_at?: string | null;
          shipping_email_sent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_slug: string;
          product_name: string;
          unit_price: number;
          unit_purchase_price: number;
          quantity: number;
          line_total: number;
          purchase_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_slug: string;
          product_name: string;
          unit_price: number;
          unit_purchase_price?: number;
          quantity: number;
          line_total: number;
          purchase_total?: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          event_type:
            | "status_changed"
            | "payment_paid"
            | "payment_failed"
            | "checkout_expired"
            | "stock_restored"
            | "tracking_updated"
            | "email_sent"
            | "refund_created"
            | "return_case_created"
            | "return_case_updated"
            | "return_case_closed";
          from_status: "new" | "confirmed" | "paid" | "shipped" | "cancelled" | null;
          to_status: "new" | "confirmed" | "paid" | "shipped" | "cancelled" | null;
          actor_type: "admin" | "stripe" | "system";
          actor_id: string | null;
          message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          event_type:
            | "status_changed"
            | "payment_paid"
            | "payment_failed"
            | "checkout_expired"
            | "stock_restored"
            | "tracking_updated"
            | "email_sent"
            | "refund_created"
            | "return_case_created"
            | "return_case_updated"
            | "return_case_closed";
          from_status?: "new" | "confirmed" | "paid" | "shipped" | "cancelled" | null;
          to_status?: "new" | "confirmed" | "paid" | "shipped" | "cancelled" | null;
          actor_type: "admin" | "stripe" | "system";
          actor_id?: string | null;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          name: string;
          created_at: string;
        };
        Insert: {
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          sku: string;
          slug: string;
          name: string;
          price: number;
          purchase_price: number;
          compare_at_price: number | null;
          category: string;
          rating: number;
          review_count: number;
          description: string;
          tag: string | null;
          features: string[];
          image_url: string | null;
          image_urls: string[];
          is_active: boolean;
          is_bundle: boolean;
          stock_quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          sku?: string;
          slug: string;
          name: string;
          price: number;
          purchase_price?: number;
          compare_at_price?: number | null;
          category: string;
          rating?: number;
          review_count?: number;
          description: string;
          tag?: string | null;
          features?: string[];
          image_url?: string | null;
          image_urls?: string[];
          is_active?: boolean;
          is_bundle?: boolean;
          stock_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sku?: string;
          slug?: string;
          name?: string;
          price?: number;
          purchase_price?: number;
          compare_at_price?: number | null;
          category?: string;
          rating?: number;
          review_count?: number;
          description?: string;
          tag?: string | null;
          features?: string[];
          image_url?: string | null;
          image_urls?: string[];
          is_active?: boolean;
          is_bundle?: boolean;
          stock_quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_bundle_items: {
        Row: {
          bundle_sku: string;
          component_sku: string;
          quantity: number;
          created_at: string;
        };
        Insert: {
          bundle_sku: string;
          component_sku: string;
          quantity: number;
          created_at?: string;
        };
        Update: {
          bundle_sku?: string;
          component_sku?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_bundle_items_bundle_sku_fkey";
            columns: ["bundle_sku"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["sku"];
          },
          {
            foreignKeyName: "product_bundle_items_component_sku_fkey";
            columns: ["component_sku"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["sku"];
          },
        ];
      };
      return_cases: {
        Row: {
          id: string;
          case_number: string;
          order_id: string;
          case_type: "return" | "claim" | "exchange";
          status:
            | "reported"
            | "awaiting_package"
            | "package_received"
            | "accepted"
            | "rejected"
            | "closed";
          customer_message: string | null;
          admin_notes: string | null;
          requested_refund_amount: number;
          approved_refund_amount: number;
          approved_product_refund_amount: number;
          approved_delivery_refund_amount: number;
          delivery_refunded: boolean;
          stripe_refund_id: string | null;
          refunded_at: string | null;
          stock_processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_number?: string;
          order_id: string;
          case_type: "return" | "claim" | "exchange";
          status?:
            | "reported"
            | "awaiting_package"
            | "package_received"
            | "accepted"
            | "rejected"
            | "closed";
          customer_message?: string | null;
          admin_notes?: string | null;
          requested_refund_amount?: number;
          approved_refund_amount?: number;
          approved_product_refund_amount?: number;
          approved_delivery_refund_amount?: number;
          delivery_refunded?: boolean;
          stripe_refund_id?: string | null;
          refunded_at?: string | null;
          stock_processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          case_type?: "return" | "claim" | "exchange";
          status?:
            | "reported"
            | "awaiting_package"
            | "package_received"
            | "accepted"
            | "rejected"
            | "closed";
          customer_message?: string | null;
          admin_notes?: string | null;
          requested_refund_amount?: number;
          approved_refund_amount?: number;
          approved_product_refund_amount?: number;
          approved_delivery_refund_amount?: number;
          delivery_refunded?: boolean;
          stripe_refund_id?: string | null;
          refunded_at?: string | null;
          stock_processed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "return_cases_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      return_case_items: {
        Row: {
          id: string;
          return_case_id: string;
          order_item_id: string;
          product_slug: string;
          product_name: string;
          quantity: number;
          restock_action: "pending" | "restock" | "discard";
          return_condition: "sellable" | "unsellable" | "needs_review";
          return_to_stock: boolean;
          condition_note: string | null;
          disposal_reason: string | null;
          restocked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          return_case_id: string;
          order_item_id: string;
          product_slug: string;
          product_name: string;
          quantity: number;
          restock_action?: "pending" | "restock" | "discard";
          return_condition?: "sellable" | "unsellable" | "needs_review";
          return_to_stock?: boolean;
          condition_note?: string | null;
          disposal_reason?: string | null;
          restocked_at?: string | null;
          created_at?: string;
        };
        Update: {
          quantity?: number;
          restock_action?: "pending" | "restock" | "discard";
          return_condition?: "sellable" | "unsellable" | "needs_review";
          return_to_stock?: boolean;
          condition_note?: string | null;
          disposal_reason?: string | null;
          restocked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "return_case_items_return_case_id_fkey";
            columns: ["return_case_id"];
            isOneToOne: false;
            referencedRelation: "return_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_case_items_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_marketing_mailing: {
        Args: { p_campaign_key: string; p_email: string };
        Returns: boolean;
      };
      unsubscribe_marketing: {
        Args: { p_email: string; p_consented_at: string };
        Returns: boolean;
      };
      revoke_marketing_preference: {
        Args: { p_email: string };
        Returns: boolean;
      };
      cancel_paid_order_after_refund: {
        Args: {
          p_order_id: string;
          p_refund_id: string;
          p_refund_reason?: string | null;
          p_refund_amount?: number;
          p_refund_product_amount?: number;
          p_refund_delivery_amount?: number;
        };
        Returns: Array<{
          order_id: string;
          status: "new" | "confirmed" | "paid" | "shipped" | "cancelled";
          stock_restored_at: string;
          stripe_refund_id: string | null;
          refunded_at: string;
        }>;
      };
      cancel_order_and_restore_stock: {
        Args: {
          p_order_id: string | null;
          p_checkout_session_id: string | null;
        };
        Returns: Array<{
          order_id: string;
          status: "new" | "confirmed" | "paid" | "shipped" | "cancelled";
          stock_restored_at: string;
        }>;
      };
      complete_return_case: {
        Args: {
          p_return_case_id: string;
          p_refund_id?: string | null;
          p_refund_amount?: number;
          p_delivery_refund_amount?: number;
        };
        Returns: Array<{
          return_case_id: string;
          status: string;
          stock_processed_at: string;
          stripe_refund_id: string | null;
          refunded_at: string | null;
        }>;
      };
      check_rate_limit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: Array<{
          allowed: boolean;
          remaining: number;
          retry_after: number;
        }>;
      };
      create_order_with_stock: {
        Args: {
          p_order: Json;
          p_items: Json;
        };
        Returns: Array<{
          order_id: string;
          order_number: string;
          created_at: string;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
