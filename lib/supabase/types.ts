export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      keyword_embeddings: {
        Row: {
          term: string;
          alias: string;
          embedding: number[];
          updated_at: string;
        };
        Insert: {
          term: string;
          alias: string;
          embedding: number[];
          updated_at?: string;
        };
        Update: {
          term?: string;
          alias?: string;
          embedding?: number[];
          updated_at?: string;
        };
        Relationships: [];
      };
      keyword_explore_cache: {
        Row: {
          term: string;
          alias: string;
          response: Json;
          fetched_at: string;
        };
        Insert: {
          term: string;
          alias: string;
          response: Json;
          fetched_at?: string;
        };
        Update: {
          term?: string;
          alias?: string;
          response?: Json;
          fetched_at?: string;
        };
        Relationships: [];
      };
      keyword_list_items: {
        Row: {
          id: number;
          list_id: string;
          term: string;
          normalized: string;
          alias: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          list_id: string;
          term: string;
          normalized: string;
          alias?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          list_id?: string;
          term?: string;
          normalized?: string;
          alias?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "keyword_list_items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "keyword_lists";
            referencedColumns: ["id"];
          }
        ];
      };
      keyword_lists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      keyword_metrics_daily: {
        Row: {
          term: string;
          alias: string;
          date: string;
          avg_bsr: number | null;
          med_bsr: number | null;
          share_merch: number | null;
          avg_reviews: number | null;
          med_reviews: number | null;
          top10_reviews_p80: number | null;
          serp_diversity: number | null;
          price_iqr: number | null;
          difficulty: number;
          competition: number;
          opportunity: number;
          momentum_7d: number | null;
          momentum_30d: number | null;
          samples: number;
          intent_tags: string[] | null;
          updated_at: string;
        };
        Insert: {
          term: string;
          alias: string;
          date: string;
          avg_bsr?: number | null;
          med_bsr?: number | null;
          share_merch?: number | null;
          avg_reviews?: number | null;
          med_reviews?: number | null;
          top10_reviews_p80?: number | null;
          serp_diversity?: number | null;
          price_iqr?: number | null;
          difficulty: number;
          competition: number;
          opportunity: number;
          momentum_7d?: number | null;
          momentum_30d?: number | null;
          samples: number;
          intent_tags?: string[] | null;
          updated_at?: string;
        };
        Update: {
          term?: string;
          alias?: string;
          date?: string;
          avg_bsr?: number | null;
          med_bsr?: number | null;
          share_merch?: number | null;
          avg_reviews?: number | null;
          med_reviews?: number | null;
          top10_reviews_p80?: number | null;
          serp_diversity?: number | null;
          price_iqr?: number | null;
          difficulty?: number;
          competition?: number;
          opportunity?: number;
          momentum_7d?: number | null;
          momentum_30d?: number | null;
          samples?: number;
          intent_tags?: string[] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      keyword_serp_queue: {
        Row: {
          id: number;
          term: string;
          alias: string;
          priority: number;
          requested_at: string;
          status: string;
        };
        Insert: {
          term: string;
          alias: string;
          priority?: number;
          requested_at?: string;
          status?: string;
          id?: number;
        };
        Update: {
          term?: string;
          alias?: string;
          priority?: number;
          requested_at?: string;
          status?: string;
          id?: number;
        };
        Relationships: [];
      };
      keyword_serp_snapshot: {
        Row: {
          id: number;
          term: string;
          alias: string;
          page: number;
          position: number;
          asin: string;
          bsr: number | null;
          reviews: number | null;
          rating: number | null;
          price_cents: number | null;
          title: string | null;
          brand: string | null;
          is_merch: boolean;
          product_type: string | null;
          fetched_at: string;
        };
        Insert: {
          term: string;
          alias: string;
          page: number;
          position: number;
          asin: string;
          bsr?: number | null;
          reviews?: number | null;
          rating?: number | null;
          price_cents?: number | null;
          title?: string | null;
          brand?: string | null;
          is_merch: boolean;
          product_type?: string | null;
          fetched_at?: string;
          id?: number;
        };
        Update: {
          term?: string;
          alias?: string;
          page?: number;
          position?: number;
          asin?: string;
          bsr?: number | null;
          reviews?: number | null;
          rating?: number | null;
          price_cents?: number | null;
          title?: string | null;
          brand?: string | null;
          is_merch?: boolean;
          product_type?: string | null;
          fetched_at?: string;
          id?: number;
        };
        Relationships: [];
      };
      keyword_settings: {
        Row: {
          id: number;
          aliases: string[];
          bfs_depth: number;
          serp_pages: number;
          topn: number;
          weight_reviews: number;
          weight_bsr: number;
          weight_merch: number;
          weight_rating: number;
          weight_diversity: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          aliases?: string[];
          bfs_depth?: number;
          serp_pages?: number;
          topn?: number;
          weight_reviews?: number;
          weight_bsr?: number;
          weight_merch?: number;
          weight_rating?: number;
          weight_diversity?: number;
          updated_at?: string;
        };
        Update: {
          id?: number;
          aliases?: string[];
          bfs_depth?: number;
          serp_pages?: number;
          topn?: number;
          weight_reviews?: number;
          weight_bsr?: number;
          weight_merch?: number;
          weight_rating?: number;
          weight_diversity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      keyword_suggestions: {
        Row: {
          id: number;
          term: string;
          alias: string;
          position: number;
          fetched_at: string;
        };
        Insert: {
          term: string;
          alias: string;
          position: number;
          fetched_at?: string;
          id?: number;
        };
        Update: {
          term?: string;
          alias?: string;
          position?: number;
          fetched_at?: string;
          id?: number;
        };
        Relationships: [];
      };
      keywords: {
        Row: {
          term: string;
          alias: string;
          normalized: string;
          created_at: string;
        };
        Insert: {
          term: string;
          alias: string;
          normalized: string;
          created_at?: string;
        };
        Update: {
          term?: string;
          alias?: string;
          normalized?: string;
          created_at?: string;
        };
        Relationships: [];
      };
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
          product_type: string | null;
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
          product_type?: string | null;
          first_seen?: string;
          last_seen?: string;
          created_at?: string;
        };
        Update: {
          asin?: string;
          title?: string | null;
          brand?: string | null;
          price_cents?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          bsr?: number | null;
          bsr_category?: string | null;
          url?: string;
          image_url?: string | null;
          bullet1?: string | null;
          bullet2?: string | null;
          merch_flag_source?: string | null;
          product_type?: string | null;
          first_seen?: string;
          last_seen?: string;
          created_at?: string;
        };
        Relationships: [];
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
          merch_flag_source: string | null;
          product_type: string | null;
          captured_at: string;
        };
        Insert: {
          asin: string;
          price_cents?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          bsr?: number | null;
          bsr_category?: string | null;
          merch_flag_source?: string | null;
          product_type?: string | null;
          captured_at?: string;
          id?: number;
        };
        Update: {
          asin?: string;
          price_cents?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          bsr?: number | null;
          bsr_category?: string | null;
          merch_flag_source?: string | null;
          product_type?: string | null;
          captured_at?: string;
          id?: number;
        };
        Relationships: [];
      };
      crawler_settings: {
        Row: {
          id: number;
          use_best_sellers: boolean;
          zgbs_pages: number;
          zgbs_paths: string[];
          use_new_releases: boolean;
          new_pages: number;
          new_paths: string[];
          use_movers: boolean;
          movers_pages: number;
          movers_paths: string[];
          use_search: boolean;
          search_pages: number;
          search_category: string | null;
          search_sort: string | null;
          search_rh: string | null;
          search_keywords: string[];
          hidden_include: string[];
          hidden_exclude: string[];
          max_items_per_run: number;
          recrawl_hours_p0: number;
          recrawl_hours_p1: number;
          recrawl_hours_p2: number;
          recrawl_hours_p3: number;
          per_page_delay_ms_min: number;
          per_page_delay_ms_max: number;
          per_product_delay_ms_min: number;
          per_product_delay_ms_max: number;
          marketplace_id: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          use_best_sellers?: boolean;
          zgbs_pages?: number;
          zgbs_paths?: string[];
          use_new_releases?: boolean;
          new_pages?: number;
          new_paths?: string[];
          use_movers?: boolean;
          movers_pages?: number;
          movers_paths?: string[];
          use_search?: boolean;
          search_pages?: number;
          search_category?: string | null;
          search_sort?: string | null;
          search_rh?: string | null;
          search_keywords?: string[];
          hidden_include?: string[];
          hidden_exclude?: string[];
          max_items_per_run?: number;
          recrawl_hours_p0?: number;
          recrawl_hours_p1?: number;
          recrawl_hours_p2?: number;
          recrawl_hours_p3?: number;
          per_page_delay_ms_min?: number;
          per_page_delay_ms_max?: number;
          per_product_delay_ms_min?: number;
          per_product_delay_ms_max?: number;
          marketplace_id?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          use_best_sellers?: boolean;
          zgbs_pages?: number;
          zgbs_paths?: string[];
          use_new_releases?: boolean;
          new_pages?: number;
          new_paths?: string[];
          use_movers?: boolean;
          movers_pages?: number;
          movers_paths?: string[];
          use_search?: boolean;
          search_pages?: number;
          search_category?: string | null;
          search_sort?: string | null;
          search_rh?: string | null;
          search_keywords?: string[];
          hidden_include?: string[];
          hidden_exclude?: string[];
          max_items_per_run?: number;
          recrawl_hours_p0?: number;
          recrawl_hours_p1?: number;
          recrawl_hours_p2?: number;
          recrawl_hours_p3?: number;
          per_page_delay_ms_min?: number;
          per_page_delay_ms_max?: number;
          per_product_delay_ms_min?: number;
          per_product_delay_ms_max?: number;
          marketplace_id?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          updated_at?: string;
        };
        Update: {
          asin?: string;
          content?: string;
          embedding?: number[] | null;
          updated_at?: string;
        };
        Relationships: [];
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
          updated_at?: string;
        };
        Update: {
          asin?: string;
          bsr_now?: number | null;
          bsr_24h?: number | null;
          bsr_7d?: number | null;
          reviews_now?: number | null;
          reviews_24h?: number | null;
          reviews_7d?: number | null;
          rating_now?: number | null;
          momentum?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: number;
          user_id: string | null;
          type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          type: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          type?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      usage_counters: {
        Row: {
          user_id: string;
          date: string;
          metric: string;
          used: number;
          limit: number;
        };
        Insert: {
          user_id: string;
          date: string;
          metric: string;
          used?: number;
          limit: number;
        };
        Update: {
          user_id?: string;
          date?: string;
          metric?: string;
          used?: number;
          limit?: number;
        };
        Relationships: [];
      };
      users_profile: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          timezone: string;
          user_id: string;
          plan_tier: string;
          plan_status: string;
          seats: number;
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          display_name?: string | null;
          timezone?: string;
          user_id: string;
          plan_tier?: string;
          plan_status?: string;
          seats?: number;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string | null;
          timezone?: string;
          user_id?: string;
          plan_tier?: string;
          plan_status?: string;
          seats?: number;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      semantic_search_merch: {
        Args: { query_vec: number[]; k: number };
        Returns: { asin: string; content: string; score: number }[];
      };
      match_keyword_embeddings: {
        Args: { query_embedding: number[]; match_count?: number | null; target_alias?: string | null };
        Returns: { term: string; alias: string; distance: number }[];
      };
      increment_usage: {
        Args: { p_user_id: string; p_metric: string; p_limit: number; p_delta?: number | null };
        Returns: { used: number; limit: number; allowed: boolean }[];
      };
      reset_usage_limits: {
        Args: { p_user_id: string; p_date: string; p_metric: string; p_limit: number };
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
