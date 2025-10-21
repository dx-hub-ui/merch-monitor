import type { Session } from "@supabase/supabase-js";

type Metadata = Record<string, unknown> | undefined | null;

function extractRoles(meta: Metadata): string[] {
  if (!meta) return [];
  const roles = (meta as { roles?: unknown }).roles;
  if (Array.isArray(roles)) {
    return roles.filter(role => typeof role === "string") as string[];
  }
  if (typeof roles === "string") {
    return [roles];
  }
  return [];
}

function extractRole(meta: Metadata): string | null {
  if (!meta) return null;
  const role = (meta as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
}

export function isAdminSession(session: Session | null | undefined): boolean {
  if (!session) return false;
  const appMeta = session.user.app_metadata ?? {};
  const userMeta = session.user.user_metadata ?? {};
  if (appMeta.is_admin === true || userMeta.is_admin === true) {
    return true;
  }
  const roles = [...extractRoles(appMeta), ...extractRoles(userMeta)];
  if (roles.includes("admin")) {
    return true;
  }
  const role = extractRole(appMeta) ?? extractRole(userMeta);
  return role === "admin";
}
