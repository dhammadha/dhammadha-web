export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "admin" | "designer" | "customer";

export interface Database {
  public: {
    Tables: {
      fonts: {
        Row: {
          id: string;
          name: string | null;
          name_th: string | null;
          slug: string;
          designer_name: string | null;
          category: string | null;
          tags: string[] | null;
          description_th: string | null;
          description_en: string | null;
          price: number | null;
          sale_price: number | null;
          discount_percent: number | null;
          is_sale: boolean;
          sale_label: string | null;
          sale_end: string | null;
          is_active: boolean;
          is_free: boolean;
          is_subscription: boolean;
          is_popular: boolean;
          cover_image_url: string | null;
          preview_images: string[] | null;
          full_font_files: string[] | null;
          demo_font_files: string[] | null;
          free_font_files: string[] | null;
          specimen_files: string[] | null;
          obfuscated_font_files: string[] | null;
          obfuscated_map: Json | null;
          has_demo: boolean;
          weight_count: number | null;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          name_th?: string | null;
          slug: string;
          designer_name?: string | null;
          category?: string | null;
          tags?: string[] | null;
          description_th?: string | null;
          description_en?: string | null;
          price?: number | null;
          sale_price?: number | null;
          discount_percent?: number | null;
          is_sale?: boolean;
          sale_label?: string | null;
          sale_end?: string | null;
          is_active?: boolean;
          is_free?: boolean;
          is_subscription?: boolean;
          is_popular?: boolean;
          cover_image_url?: string | null;
          preview_images?: string[] | null;
          full_font_files?: string[] | null;
          demo_font_files?: string[] | null;
          free_font_files?: string[] | null;
          specimen_files?: string[] | null;
          obfuscated_font_files?: string[] | null;
          obfuscated_map?: Json | null;
          has_demo?: boolean;
          weight_count?: number | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          name_th?: string | null;
          slug?: string;
          designer_name?: string | null;
          category?: string | null;
          tags?: string[] | null;
          description_th?: string | null;
          description_en?: string | null;
          price?: number | null;
          sale_price?: number | null;
          discount_percent?: number | null;
          is_sale?: boolean;
          sale_label?: string | null;
          sale_end?: string | null;
          is_active?: boolean;
          is_free?: boolean;
          is_subscription?: boolean;
          is_popular?: boolean;
          cover_image_url?: string | null;
          preview_images?: string[] | null;
          full_font_files?: string[] | null;
          demo_font_files?: string[] | null;
          free_font_files?: string[] | null;
          specimen_files?: string[] | null;
          obfuscated_font_files?: string[] | null;
          obfuscated_map?: Json | null;
          has_demo?: boolean;
          weight_count?: number | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          contact_name: string;
          company_name: string;
          address: string;
          tax_id: string;
          email: string;
          license_type: string;
          fonts: string[];
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_name: string;
          company_name: string;
          address: string;
          tax_id: string;
          email: string;
          license_type: string;
          fonts: string[];
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_name?: string;
          company_name?: string;
          address?: string;
          tax_id?: string;
          email?: string;
          license_type?: string;
          fonts?: string[];
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          role: string;
          name: string | null;
          business_name: string | null;
          entity_type: string;
          designer_slug: string | null;
          designer_id: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          tax_id: string | null;
          bank: Json | null;
          is_active: boolean;
          revenue_share_percent: number | null;
          payout_method: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role?: string;
          name?: string | null;
          business_name?: string | null;
          entity_type?: string;
          designer_slug?: string | null;
          designer_id?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          tax_id?: string | null;
          bank?: Json | null;
          is_active?: boolean;
          revenue_share_percent?: number | null;
          payout_method?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          name?: string | null;
          business_name?: string | null;
          entity_type?: string;
          designer_slug?: string | null;
          designer_id?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          tax_id?: string | null;
          bank?: Json | null;
          is_active?: boolean;
          revenue_share_percent?: number | null;
          payout_method?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
    };
  };
}
