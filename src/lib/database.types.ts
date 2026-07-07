export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["fonts"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fonts"]["Insert"]>;
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["settings"]["Row"], "updated_at"> & {
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["quotes"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
