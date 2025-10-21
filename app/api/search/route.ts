import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) {
    return NextResponse.json([], { status: 200 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    return NextResponse.json([], { status: 200 });
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

  const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch } });
  const { data, error } = await supabase.rpc("semantic_search_merch", {
    query_vec: embedding,
    k: 15
  });

  if (error) {
    const response = NextResponse.json([], { status: 200 });
    response.headers.set("x-error", error.message);
    return response;
  }

  return NextResponse.json(data ?? [], { status: 200 });
}
