import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { AuthSessionMissingError } from "@supabase/auth-js";
import type { Database } from "@/lib/supabase/types";
import { normalizeSupabaseCookies } from "@/lib/supabase/cookies";

const AUTH_PATHS = new Set(["/login", "/signup"]);
export async function middleware(request: NextRequest) {
  if (process.env.E2E_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  normalizeSupabaseCookies(request.cookies);

  let response = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req: request, res: response });
  const { error: sessionError } = await supabase.auth.getSession();
  if (sessionError && !(sessionError instanceof AuthSessionMissingError)) {
    throw sessionError;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError && !(userError instanceof AuthSessionMissingError)) {
    throw userError;
  }

  const pathname = request.nextUrl.pathname;
  const isAuthPage = AUTH_PATHS.has(pathname);
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated && !isAuthPage && pathname.startsWith("/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  const planTier = (user?.app_metadata as Record<string, unknown> | undefined)?.plan_tier;
  const planStatus = (user?.app_metadata as Record<string, unknown> | undefined)?.plan_status;
  const trialActive = (user?.app_metadata as Record<string, unknown> | undefined)?.trial_active;
  const seats = (user?.app_metadata as Record<string, unknown> | undefined)?.seats;

  if (user) {
    const cookieSnapshot = response.cookies.getAll();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-plan-tier", planTier === "pro" ? "pro" : "basic");
    requestHeaders.set("x-plan-status", typeof planStatus === "string" ? planStatus : "inactive");
    requestHeaders.set("x-trial-active", trialActive ? "true" : "false");
    requestHeaders.set("x-plan-seats", seats ? String(seats) : "1");

    const enrichedResponse = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });

    for (const cookie of cookieSnapshot) {
      enrichedResponse.cookies.set(cookie);
    }

    response = enrichedResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/).*)"]
};
