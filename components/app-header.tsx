"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type Props = { email: string | null; isAdmin?: boolean };

export function AppHeader({ email, isAdmin = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-gradient-to-r from-brand-deeper via-brand-dark to-brand/90 text-white shadow-lg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="app-header-navigation-mobile"
              aria-label="Toggle navigation"
            >
              <span className="sr-only">Toggle navigation</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  className="transition-all"
                  d={
                    menuOpen
                      ? "M6.47 6.47a.75.75 0 0 1 1.06 0L12 10.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L13.06 12l4.47 4.47a.75.75 0 1 1-1.06 1.06L12 13.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L10.94 12 6.47 7.53a.75.75 0 0 1 0-1.06Z"
                      : "M6 6.75A.75.75 0 0 1 6.75 6h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 6.75Zm0 5.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 12Zm.75 4.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H6.75Z"
                  }
                  fill="currentColor"
                />
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white shadow-inner">
                MW
              </span>
              Merch Watcher
            </Link>
          </div>
          <nav className="hidden items-center gap-4 text-sm font-medium text-white/80 md:flex">
            <Link className="transition-colors hover:text-white" href="/">
              Dashboard
            </Link>
            <Link className="transition-colors hover:text-white" href="/trends">
              Trends
            </Link>
            <Link className="transition-colors hover:text-white" href="/keywords/explore">
              Keywords
            </Link>
            {isAdmin ? (
              <Link className="transition-colors hover:text-white" href="/admin/crawler">
                Crawler
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserMenu email={email} />
          </div>
        </div>
        <nav
          id="app-header-navigation-mobile"
          className="md:hidden"
          aria-label="Mobile navigation"
        >
          {menuOpen ? (
            <div className="flex flex-col gap-1 rounded-2xl border border-white/20 bg-white/10 p-3 text-sm font-medium text-white/90 shadow-lg backdrop-blur">
              <Link className="rounded-lg px-3 py-2 transition hover:bg-white/10" href="/">
                Dashboard
              </Link>
              <Link className="rounded-lg px-3 py-2 transition hover:bg-white/10" href="/trends">
                Trends
              </Link>
              <Link className="rounded-lg px-3 py-2 transition hover:bg-white/10" href="/keywords/explore">
                Keywords
              </Link>
              {isAdmin ? (
                <Link className="rounded-lg px-3 py-2 transition hover:bg-white/10" href="/admin/crawler">
                  Crawler
                </Link>
              ) : null}
            </div>
          ) : null}
        </nav>
      </div>
      {menuOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-30 cursor-pointer md:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
    </header>
  );
}
