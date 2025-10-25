"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type SVGProps
} from "react";
import clsx from "clsx";
import { useTheme } from "next-themes";
import { Check, ChevronDown, LogOut, MonitorCog, Moon, Settings, Sun, UserRound } from "lucide-react";
import { signOut } from "@/lib/supabase/auth";

type UserMenuProps = {
  email: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: MonitorCog }
];

export function UserMenu({ email, displayName, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const activeTheme = mounted ? theme : "system";
  const display = displayName?.trim() || email || "Account";
  const initials = display
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const AvatarIcon = UserRound;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-2 py-1 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar fallback={initials} src={avatarUrl} alt={display} />
        <span className="hidden sm:inline">{display}</span>
        <ChevronDown className={clsx("h-4 w-4 transition", open ? "rotate-180" : "rotate-0")} aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200/70 bg-white/95 p-3 text-sm shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
          <div className="mb-3 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <Avatar fallback={initials} src={avatarUrl} alt={display} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{display}</p>
              {email ? (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Theme</p>
              <div className="space-y-1">
                {THEME_OPTIONS.map(option => {
                  const Icon = option.icon;
                  const isActive =
                    activeTheme === option.value || (activeTheme === "system" && option.value === "system");
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                        isActive
                          ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800/80 dark:text-slate-100"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {option.label}
                      </span>
                      {isActive ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <nav className="space-y-1">
              <MenuLink href="/profile" icon={AvatarIcon} onClick={() => setOpen(false)}>
                My profile
              </MenuLink>
              <MenuLink href="/account" icon={Settings} onClick={() => setOpen(false)}>
                Account settings
              </MenuLink>
            </nav>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await signOut();
                })
              }
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:text-red-400 dark:hover:bg-red-500/10"
              disabled={pending}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type AvatarProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: "sm" | "lg";
};

function Avatar({ src, alt, fallback, size = "sm" }: AvatarProps) {
  const dimension = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const cleanedSrc = typeof src === "string" && src.trim().length > 0 ? src : null;
  if (cleanedSrc) {
    return (
      <img
        src={cleanedSrc}
        alt={alt}
        className={clsx(
          dimension,
          "flex-shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
        )}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={clsx(
        dimension,
        "flex-shrink-0 rounded-full border border-slate-200 bg-slate-200 text-sm font-semibold uppercase text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      )}
    >
      <span className="flex h-full w-full items-center justify-center">{fallback || alt[0]?.toUpperCase() || "U"}</span>
    </div>
  );
}

type MenuLinkProps = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  onClick?: () => void;
};

function MenuLink({ href, icon: Icon, children, onClick }: MenuLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
