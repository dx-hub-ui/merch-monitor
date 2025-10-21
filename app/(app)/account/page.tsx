import { changePassword, signOut } from "@/lib/supabase/auth";
import { getSession } from "@/lib/supabase/queries";
import { ChangePasswordForm } from "@/components/change-password-form";

export const metadata = { title: "Account • Merch Watcher" };

export default async function AccountPage() {
  const session = await getSession();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Account</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your credentials and sign out.</p>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <dl className="grid gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="text-base font-medium text-slate-900 dark:text-slate-100">{session?.user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">User ID</dt>
            <dd className="break-all text-xs font-mono">{session?.user.id}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change password</h2>
        <ChangePasswordForm action={changePassword} />
      </div>
      <form action={signOut} className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Sign out</h2>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
