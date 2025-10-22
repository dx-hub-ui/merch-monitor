import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe/client";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import type { Database } from "@/lib/supabase/types";
import { getStripePriceIdForPlan, type PlanTier } from "@/lib/billing/plans";
import type Stripe from "stripe";

const requestSchema = z.object({
  plan: z.enum(["basic", "pro"])
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = parsed.data.plan as PlanTier;

  const userId = user.id as Database["public"]["Tables"]["users_profile"]["Row"]["user_id"];

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .select("plan_status,trial_ends_at,stripe_customer_id,stripe_subscription_id")
    .match({ user_id: userId })
    .maybeSingle<Pick<
      Database["public"]["Tables"]["users_profile"]["Row"],
      "plan_status" | "trial_ends_at" | "stripe_customer_id" | "stripe_subscription_id"
    >>();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const stripe = getStripeClient();
  const priceId = getStripePriceIdForPlan(plan);

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
        plan_requested: plan
      }
    });
    customerId = customer.id;
    await (supabase.from("users_profile") as unknown as {
      upsert: (
        values: Database["public"]["Tables"]["users_profile"]["Insert"],
        options?: Parameters<ReturnType<typeof supabase.from>["upsert"]>[1]
      ) => ReturnType<ReturnType<typeof supabase.from>["upsert"]>;
    }).upsert({
      user_id: userId,
      stripe_customer_id: customerId
    });
  } else {
    await stripe.customers.update(customerId, {
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
        plan_requested: plan
      }
    });
  }

  const now = Date.now();
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null;
  const hasActiveTrial = typeof trialEndsAt === "number" && trialEndsAt > now;

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: {
      supabase_user_id: userId,
      plan
    }
  };

  if (plan === "basic" && !profile?.stripe_subscription_id && !hasActiveTrial) {
    subscriptionData.trial_period_days = 7;
  }

  const url = new URL(request.url);
  const origin = request.headers.get("origin") ?? `${url.protocol}//${url.host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_update: { address: "auto" },
    billing_address_collection: "required",
    customer_email: user.email ?? undefined,
    success_url: `${origin}/account/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account/billing`,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    subscription_data: subscriptionData,
    invoice_creation: { enabled: true }
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}
