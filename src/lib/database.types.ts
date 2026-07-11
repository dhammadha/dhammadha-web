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
          published_at: string | null;
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
          published_at?: string | null;
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
          published_at?: string | null;
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
      designer_license_config: {
        Row: {
          id: string;
          designer_id: string;
          use_default: boolean;
          license_pdf_url: string | null;
          tiers: Json | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          designer_id: string;
          use_default?: boolean;
          license_pdf_url?: string | null;
          tiers?: Json | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          designer_id?: string;
          use_default?: boolean;
          license_pdf_url?: string | null;
          tiers?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      font_files_private: {
        Row: {
          font_id: string;
          full_font_files: string[] | null;
          updated_at: string;
        };
        Insert: {
          font_id: string;
          full_font_files?: string[] | null;
          updated_at?: string;
        };
        Update: {
          font_id?: string;
          full_font_files?: string[] | null;
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
          designer_id: string | null;
          quote_no: string | null;
          receipt_no: string | null;
          quote_issued_at: string | null;
          receipt_issued_at: string | null;
          total_amount: number | null;
          fonts_detail: Json | null;
          issued_by: string | null;
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
          designer_id?: string | null;
          quote_no?: string | null;
          receipt_no?: string | null;
          quote_issued_at?: string | null;
          receipt_issued_at?: string | null;
          total_amount?: number | null;
          fonts_detail?: Json | null;
          issued_by?: string | null;
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
          designer_id?: string | null;
          quote_no?: string | null;
          receipt_no?: string | null;
          quote_issued_at?: string | null;
          receipt_issued_at?: string | null;
          total_amount?: number | null;
          fonts_detail?: Json | null;
          issued_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_no: string;
          quote_id: string | null;
          designer_id: string | null;
          customer_user_id: string | null;
          customer_email: string;
          customer_name: string | null;
          company_name: string | null;
          items: Json;
          total_amount: number;
          status: "pending" | "paid" | "cancelled";
          paid_at: string | null;
          source: "quote" | "checkout";
          payment_provider: string | null;
          provider_session_id: string | null;
          provider_payment_intent: string | null;
          platform_rate: number | null;
          platform_amount: number | null;
          designer_amount: number | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      entitlements: {
        Row: {
          id: string;
          order_id: string;
          font_id: string;
          user_id: string | null;
          email: string;
          license_type: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      download_logs: {
        Row: {
          id: number;
          entitlement_id: string;
          user_id: string | null;
          font_id: string | null;
          file_path: string | null;
          ip: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      subscription_waitlist: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
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
          portfolio_url: string | null;
          designer_application_status: 'pending' | 'approved' | 'rejected' | null;
          marketing_consent_at: string | null;
          designer_agreement_accepted_at: string | null;
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
          portfolio_url?: string | null;
          designer_application_status?: 'pending' | 'approved' | 'rejected' | null;
          marketing_consent_at?: string | null;
          designer_agreement_accepted_at?: string | null;
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
          portfolio_url?: string | null;
          designer_application_status?: 'pending' | 'approved' | 'rejected' | null;
          marketing_consent_at?: string | null;
          designer_agreement_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          designer_id: string;
          period_year: number;
          period_month: number;
          amount: number;
          note: string | null;
          paid_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          designer_id: string;
          period_year: number;
          period_month: number;
          amount: number;
          note?: string | null;
          paid_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          designer_id?: string;
          period_year?: number;
          period_month?: number;
          amount?: number;
          note?: string | null;
          paid_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      font_events: {
        Row: {
          id: number;
          font_id: string;
          kind: "view" | "free_download";
          user_id: string | null;
          session_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          font_id: string;
          kind: "view" | "free_download";
          user_id?: string | null;
          session_key?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      admin_upsert_font: {
        Args: { p_id: string | null; p_data: Record<string, unknown> };
        Returns: Record<string, unknown>;
      };
      publish_fonts: {
        Args: Record<string, never>;
        Returns: void;
      };
      confirm_quote_paid: {
        Args: { p_quote_id: string; p_items: Json };
        Returns: Json;
      };
      claim_my_entitlements: {
        Args: Record<string, never>;
        Returns: number;
      };
      verify_order: {
        Args: { p_order_no: string };
        Returns: Json;
      };
      checkout_order_status: {
        Args: { p_session_id: string };
        Returns: Json;
      };
      issue_quote_doc: {
        Args: { p_quote_id: string; p_doc_type: string };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
    };
  };
}
