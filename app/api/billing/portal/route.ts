import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("users_profile")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
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
