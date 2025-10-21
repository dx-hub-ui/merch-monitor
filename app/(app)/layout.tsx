import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSession } from "@/lib/supabase/queries";
import { isAdminSession } from "@/lib/auth/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = isAdminSession(session);

  return (
    <div className="flex min-h-screen flex-col bg-white/75 shadow-[0_20px_60px_rgba(46,16,101,0.15)] backdrop-blur supports-[backdrop-filter]:bg-white/65 dark:bg-slate-950/80 dark:shadow-[0_20px_60px_rgba(12,5,33,0.45)]">
      <AppHeader email={session.user.email ?? null} isAdmin={isAdmin} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
