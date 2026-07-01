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
          pickup_point: string | null;
          notes: string | null;
          subtotal: number;
          delivery_cost: number;
          total: number;
          payment_method: "manual";
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
          pickup_point?: string | null;
          notes?: string | null;
          subtotal: number;
          delivery_cost: number;
          total: number;
          payment_method?: "manual";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "new" | "confirmed" | "paid" | "shipped" | "cancelled";
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
          quantity: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_slug: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          line_total: number;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
