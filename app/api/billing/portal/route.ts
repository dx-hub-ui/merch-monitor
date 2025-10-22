import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profileQuery = supabase.from("users_profile").select("stripe_customer_id");
  const { data: profile, error } = await (profileQuery as unknown as {
    eq: (
      column: "user_id",
      value: Database["public"]["Tables"]["users_profile"]["Row"]["user_id"]
    ) => typeof profileQuery;
    maybeSingle: typeof profileQuery.maybeSingle;
  })
    .eq("user_id", user.id as Database["public"]["Tables"]["users_profile"]["Row"]["user_id"])
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No billing profile" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const url = new URL(request.url);
  const origin = request.headers.get("origin") ?? `${url.protocol}//${url.host}`;

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/account/billing`
  });

  return NextResponse.json({ url: portal.url }, { status: 200 });
}
