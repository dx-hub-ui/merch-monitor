import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppHeader({ email, isAdmin = false }: { email: string | null; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-gradient-to-r from-brand-deeper via-brand-dark to-brand/90 text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white shadow-inner">MW</span>
            Merch Watcher
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium text-white/80 md:flex">
            <Link className="transition-colors hover:text-white" href="/">
              Dashboard
            </Link>
            <Link className="transition-colors hover:text-white" href="/trends">
              Trends
            </Link>
            {isAdmin ? (
              <Link className="transition-colors hover:text-white" href="/admin/crawler">
                Crawler
              </Link>
            ) : null}
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
