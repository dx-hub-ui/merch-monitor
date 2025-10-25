import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getSession, getUserProfile } from "@/lib/supabase/queries";

export const metadata = { title: "My Profile • Merch Watcher" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const profile = await getUserProfile(session.user.id as Parameters<typeof getUserProfile>[0]);

  const displayName =
    profile?.display_name ??
    (typeof session.user.user_metadata?.full_name === "string"
      ? session.user.user_metadata.full_name
      : typeof session.user.user_metadata?.name === "string"
        ? session.user.user_metadata.name
        : session.user.email ?? "");

  const avatarUrl =
    profile?.avatar_url ??
    (typeof session.user.user_metadata?.avatar_url === "string"
      ? session.user.user_metadata.avatar_url
      : typeof session.user.user_metadata?.avatar === "string"
        ? session.user.user_metadata.avatar
        : null);

  const timezone = profile?.timezone ?? "UTC";

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">My profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Update your avatar, display name, and timezone preferences.
        </p>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <ProfileForm displayName={displayName} timezone={timezone} avatarUrl={avatarUrl ?? null} />
      </div>
    </section>
  );
}
