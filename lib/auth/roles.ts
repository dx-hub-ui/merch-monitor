import type { Session, User } from "@supabase/supabase-js";
import type { AuthenticatedSession } from "@/lib/supabase/queries";

type Metadata = Record<string, unknown> | undefined | null;

function normaliseRole(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalised = value.trim().toLowerCase();
  return normalised.length > 0 ? normalised : null;
}

function extractRoles(meta: Metadata): string[] {
  if (!meta) return [];
  const roles = (meta as { roles?: unknown }).roles;
  if (Array.isArray(roles)) {
    return roles
      .filter((role): role is string => typeof role === "string")
      .map(role => normaliseRole(role))
      .filter((role): role is string => Boolean(role));
  }
  if (typeof roles === "string") {
    return roles
      .split(",")
      .map(role => normaliseRole(role))
      .filter((role): role is string => Boolean(role));
  }
  return [];
}

function extractRole(meta: Metadata): string | null {
  if (!meta) return null;
  const role = (meta as { role?: unknown }).role;
  if (typeof role === "string") {
    return normaliseRole(role);
  }
  return null;
}

function hasAdminFlag(meta: Metadata): boolean {
  if (!meta) return false;
  const flag = (meta as { is_admin?: unknown }).is_admin;
  if (flag === true) {
    return true;
  }
  if (typeof flag === "string") {
    const normalised = flag.trim().toLowerCase();
    return normalised === "true" || normalised === "1" || normalised === "yes";
  }
  return false;
}

function extractUser(
  sessionOrUser: Session | AuthenticatedSession | User | null | undefined
): User | null {
  if (!sessionOrUser) return null;
  if ("user" in sessionOrUser) {
    return sessionOrUser.user;
  }
  return sessionOrUser;
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};
  if (hasAdminFlag(appMeta) || hasAdminFlag(userMeta)) {
    return true;
  }
  const roles = [...extractRoles(appMeta), ...extractRoles(userMeta)];
  if (roles.includes("admin")) {
    return true;
  }
  const role = extractRole(appMeta) ?? extractRole(userMeta);
  return role === "admin";
}

export function isAdminSession(
  session: Session | AuthenticatedSession | null | undefined
): boolean {
  const user = extractUser(session);
  return isAdminUser(user);
}
