export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      merch_products: {
        Row: {
          asin: string;
          title: string | null;
          brand: string | null;
          price_cents: number | null;
          rating: number | null;
          reviews_count: number | null;
          bsr: number | null;
          bsr_category: string | null;
          url: string;
          image_url: string | null;
          bullet1: string | null;
          bullet2: string | null;
          merch_flag_source: string | null;
          first_seen: string;
          last_seen: string;
          created_at: string;
        };
        Insert: {
          asin: string;
          title?: string | null;
          brand?: string | null;
          price_cents?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          bsr?: number | null;
          bsr_category?: string | null;
          url: string;
          image_url?: string | null;
          bullet1?: string | null;
          bullet2?: string | null;
          merch_flag_source?: string | null;
          first_seen?: string;
          last_seen?: string;
        };
        Update: Database["public"]["Tables"]["merch_products"]["Insert"];
      };
      merch_products_history: {
        Row: {
          id: number;
          asin: string;
          price_cents: number | null;
          rating: number | null;
          reviews_count: number | null;
          bsr: number | null;
          bsr_category: string | null;
          captured_at: string;
        };
        Insert: {
          asin: string;
          price_cents?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          bsr?: number | null;
          bsr_category?: string | null;
          captured_at?: string;
        };
        Update: Database["public"]["Tables"]["merch_products_history"]["Insert"];
      };
      merch_embeddings: {
        Row: {
          asin: string;
          content: string;
          embedding: number[] | null;
          updated_at: string;
        };
        Insert: {
          asin: string;
          content: string;
          embedding?: number[] | null;
        };
        Update: Database["public"]["Tables"]["merch_embeddings"]["Insert"];
      };
      merch_trend_metrics: {
        Row: {
          asin: string;
          bsr_now: number | null;
          bsr_24h: number | null;
          bsr_7d: number | null;
          reviews_now: number | null;
          reviews_24h: number | null;
          reviews_7d: number | null;
          rating_now: number | null;
          momentum: number | null;
          updated_at: string;
        };
        Insert: {
          asin: string;
          bsr_now?: number | null;
          bsr_24h?: number | null;
          bsr_7d?: number | null;
          reviews_now?: number | null;
          reviews_24h?: number | null;
          reviews_7d?: number | null;
          rating_now?: number | null;
          momentum?: number | null;
        };
        Update: Database["public"]["Tables"]["merch_trend_metrics"]["Insert"];
      };
    };
    Functions: {
      semantic_search_merch: {
        Args: { query_vec: number[]; k: number };
        Returns: { asin: string; content: string; score: number }[];
      };
    };
  };
};
