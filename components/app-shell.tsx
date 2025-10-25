"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type SVGProps
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  TrendingUp,
  X
} from "lucide-react";
import { UserMenu } from "./user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type AppShellProfile = {
  displayName?: string | null;
  avatarUrl?: string | null;
};

type AppShellProps = {
  children: React.ReactNode;
  email: string | null;
  isAdmin?: boolean;
  profile?: AppShellProfile;
};

const SIDEBAR_EXPANDED_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export function AppShell({ children, email, isAdmin = false, profile }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/trends", label: "Trends", icon: TrendingUp },
      { href: "/keywords/explore", label: "Keywords", icon: Search }
    ];
    if (isAdmin) {
      items.push({ href: "/admin/crawler", label: "Crawler", icon: Settings2 });
    }
    return items;
  }, [isAdmin]);

  const desktopSidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div
      className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      style={
        {
          "--sidebar-expanded-width": `${SIDEBAR_EXPANDED_WIDTH}px`,
          "--sidebar-current-width": `${desktopSidebarWidth}px`
        } as CSSProperties
      }
    >
      <aside
        className="sticky top-0 hidden h-screen flex-col border-r border-slate-200/60 bg-white/80 px-3 py-4 backdrop-blur transition-[width] duration-200 dark:border-slate-800/70 dark:bg-slate-900/70 md:flex"
        style={{ width: desktopSidebarWidth }}
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <Brand collapsed={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed(value => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
        <nav className="mt-6 flex-1 space-y-1">
          {navItems.map(item => {
            const isActive =
              item.href === "/"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand text-white shadow"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
                )}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
              >
                <ItemIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className={clsx("transition-opacity", collapsed ? "sr-only" : "block")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navItems={navItems}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/70 dark:bg-slate-950/70">
          <div
            className="grid h-16 items-center"
            style={{ gridTemplateColumns: `${SIDEBAR_EXPANDED_WIDTH}px 1fr auto` }}
          >
            <div className="flex h-full items-center gap-3 px-4">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <Brand collapsed={false} />
            </div>
            <div aria-hidden="true" />
            <div className="flex h-full items-center justify-end gap-3 px-4">
              <UserMenu
                email={email}
                displayName={profile?.displayName ?? email}
                avatarUrl={profile?.avatarUrl ?? null}
              />
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col px-4 py-6 md:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

type BrandProps = { collapsed: boolean };

function Brand({ collapsed }: BrandProps) {
  return (
    <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-base font-bold text-white shadow-inner">
        MW
      </span>
      <span className={clsx("transition-opacity", collapsed ? "sr-only" : "block")}>Merch Watcher</span>
    </Link>
  );
}

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
};

function MobileSidebar({ open, onClose, navItems }: MobileSidebarProps) {
  return (
    <>
      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r border-slate-200 bg-white/95 px-4 py-4 shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-950/95 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Brand collapsed={false} />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="mt-6 space-y-1">
          {navItems.map(item => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <ItemIcon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur md:hidden"
          role="presentation"
          onClick={onClose}
        />
      ) : null}
    </>
  );
}
