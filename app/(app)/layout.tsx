import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSession } from "@/lib/supabase/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader email={session.user.email ?? null} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
