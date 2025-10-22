import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPlanFromPriceId, type PlanStatus, type PlanTier } from "@/lib/billing/plans";
import type { Database, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

const STATUS_MAP: Record<string, PlanStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete: "past_due",
  incomplete_expired: "canceled"
};

function mapPlanStatus(status: string | null | undefined): PlanStatus {
  return STATUS_MAP[status ?? ""] ?? "inactive";
}

function normalisePlanTier(priceTier: PlanTier | null, status: PlanStatus): PlanTier {
  if (priceTier === "pro" && status !== "canceled" && status !== "inactive") {
    return "pro";
  }
  return "basic";
}

function serialiseEvent(event: Stripe.Event): Json {
  return JSON.parse(JSON.stringify(event)) as Json;
}

async function resolveUserId(stripe: Stripe, subscription: Stripe.Subscription): Promise<string | null> {
  const metadataUser = subscription.metadata?.supabase_user_id;
  if (metadataUser && typeof metadataUser === "string") {
    return metadataUser;
  }
  const customer = subscription.customer;
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) {
    return null;
  }
  const customerRecord = await stripe.customers.retrieve(customerId);
  if (!customerRecord || customerRecord.deleted) {
    return null;
  }
  const customerMetadata = (customerRecord as Stripe.Customer).metadata;
  const metaUser = customerMetadata?.supabase_user_id;
  return typeof metaUser === "string" ? metaUser : null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Missing webhook configuration" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const insertEvent = async (userId: string | null) => {
    await supabase.from("subscription_events").insert({
      user_id: userId,
      type: event.type,
      payload: serialiseEvent(event)
    });
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = (session.metadata?.supabase_user_id as string) || session.client_reference_id || null;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

      if (userId && (customerId || subscriptionId)) {
        const updates: Partial<Database["public"]["Tables"]["users_profile"]["Insert"]> & { user_id: string } = {
          user_id: userId,
          stripe_customer_id: customerId ?? undefined,
          stripe_subscription_id: subscriptionId ?? undefined
        };
        await supabase.from("users_profile").upsert(updates, { onConflict: "user_id" });
      }

      await insertEvent(userId);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(stripe, subscription);
      await insertEvent(userId);
      if (!userId) {
        break;
      }

      const priceId = subscription.items.data[0]?.price?.id ?? null;
      const priceTier = getPlanFromPriceId(priceId);
      const planStatus = event.type === "customer.subscription.deleted" ? "canceled" : mapPlanStatus(subscription.status);
      const planTier = normalisePlanTier(priceTier, planStatus);
      const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

      const updates: Partial<Database["public"]["Tables"]["users_profile"]["Insert"]> & { user_id: string } = {
        user_id: userId,
        plan_tier: planTier,
        plan_status: planStatus,
        trial_ends_at: trialEndsAt ?? undefined,
        stripe_customer_id: customerId ?? undefined,
        stripe_subscription_id: event.type === "customer.subscription.deleted" ? null : subscription.id
      };

      if (planStatus === "canceled") {
        updates.plan_status = "canceled";
      }
      if (planStatus === "inactive") {
        updates.plan_status = "inactive";
      }

      await supabase.from("users_profile").upsert(updates, { onConflict: "user_id" });
      break;
    }
    default: {
      await insertEvent(null);
      break;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
