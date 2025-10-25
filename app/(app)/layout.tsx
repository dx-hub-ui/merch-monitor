import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession, getUserProfile } from "@/lib/supabase/queries";
import { isAdminSession } from "@/lib/auth/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  let profile: Awaited<ReturnType<typeof getUserProfile>> = null;
  try {
    profile = await getUserProfile(session.user.id as Parameters<typeof getUserProfile>[0]);
  } catch (error) {
    console.error("Failed to load user profile for layout", error);
  }
  const isAdmin = isAdminSession(session);

  const displayName =
    profile?.display_name ??
    (typeof session.user.user_metadata?.full_name === "string"
      ? session.user.user_metadata.full_name
      : typeof session.user.user_metadata?.name === "string"
        ? session.user.user_metadata.name
        : session.user.email ?? null);

  const avatarUrl =
    profile?.avatar_url ??
    (typeof session.user.user_metadata?.avatar_url === "string"
      ? session.user.user_metadata.avatar_url
      : typeof session.user.user_metadata?.avatar === "string"
        ? session.user.user_metadata.avatar
        : null);

  return (
    <AppShell
      email={session.user.email ?? null}
      isAdmin={isAdmin}
      profile={{
        displayName,
        avatarUrl
      }}
    >
      {children}
    </AppShell>
  );
}
