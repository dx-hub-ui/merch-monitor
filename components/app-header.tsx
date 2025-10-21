import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppHeader({ email }: { email: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">MW</span>
            Merch Watcher
          </Link>
          <nav className="hidden items-center gap-3 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <Link className="hover:text-brand dark:hover:text-brand" href="/">
              Dashboard
            </Link>
            <Link className="hover:text-brand dark:hover:text-brand" href="/trends">
              Trends
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}
