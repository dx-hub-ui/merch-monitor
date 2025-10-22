import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_KEYWORD_ALIAS } from "@/lib/keywords";
import { fetchKeywordOverview } from "@/lib/keywords/server";
import type { KeywordSupabaseClient } from "@/lib/keywords/server";
import type { Database } from "@/lib/supabase/types";

export const runtime = "edge";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase credentials are not configured" },
      { status: 500 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const term = typeof (payload as { term?: unknown }).term === "string" ? (payload as { term?: string }).term : "";
  const aliasInput = typeof (payload as { alias?: unknown }).alias === "string" ? (payload as { alias?: string }).alias : undefined;

  if (!term || !term.trim()) {
    return NextResponse.json({ error: "Keyword term is required" }, { status: 400 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { global: { fetch } });

  try {
    const result = await fetchKeywordOverview(term, {
      alias: aliasInput ?? DEFAULT_KEYWORD_ALIAS,
      supabase: supabase as unknown as KeywordSupabaseClient
    });

    if (!result) {
      return NextResponse.json(
        {
          term: term.trim(),
          alias: (aliasInput ?? DEFAULT_KEYWORD_ALIAS).toLowerCase(),
          normalized: term.trim().toLowerCase(),
          fetchedAt: null,
          metrics: [],
          serp: [],
          suggestions: [],
          relatedTerms: [],
          summary: null
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch keyword overview", error);
    const response = NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    if (error instanceof Error) {
      response.headers.set("x-error", error.message);
    }
    return response;
  }
}
