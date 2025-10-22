import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { extractEntitlements } from "@/lib/billing/claims";
import { enforceDailyUsage } from "@/lib/billing/usage";
import { USAGE_METRICS } from "@/lib/billing/plans";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) {
    return NextResponse.json([], { status: 200 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json([], { status: 200 });
  }

  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entitlements = extractEntitlements(user);
  const usage = await enforceDailyUsage({
    client: supabase,
    userId: user.id,
    planTier: entitlements.planTier,
    metric: USAGE_METRICS.keywordSearch
  });

  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: "DAILY_KEYWORD_LIMIT_REACHED",
        message: "You have reached your daily keyword search allowance.",
        metric: USAGE_METRICS.keywordSearch,
        used: usage.used,
        limit: usage.limit
      },
      { status: 402 }
    );
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query
  });

  const embedding = embeddingRes.data[0]?.embedding;
  if (!embedding) {
    return NextResponse.json([], { status: 200 });
  }

  const { data, error } = await supabase.rpc("semantic_search_merch", {
    query_vec: embedding,
    k: 15
  });

  if (error) {
    const response = NextResponse.json([], { status: 200 });
    response.headers.set("x-error", error.message);
    return response;
  }

  const response = NextResponse.json(data ?? [], { status: 200 });
  response.headers.set("x-usage-remaining", Math.max(usage.remaining, 0).toString());
  response.headers.set("x-usage-limit", usage.limit.toString());
  return response;
}
