import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/supabase/types";
import { decodeSupabaseCookieValue } from "@/lib/supabase/cookies";

const AUTH_PATHS = new Set(["/login", "/signup"]);
const SUPABASE_COOKIE_NAME_PREFIX = "sb-";

function normalizeSupabaseCookies(request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith(SUPABASE_COOKIE_NAME_PREFIX)) {
      continue;
    }

    const decoded = decodeSupabaseCookieValue(cookie.value);
    if (decoded !== cookie.value) {
      request.cookies.set(cookie.name, decoded);
    }
  }
}

export async function middleware(request: NextRequest) {
  if (process.env.E2E_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  normalizeSupabaseCookies(request);

  const response = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req: request, res: response });
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = AUTH_PATHS.has(pathname);

  if (!session && !isAuthPage && pathname.startsWith("/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/).*)"]
};
