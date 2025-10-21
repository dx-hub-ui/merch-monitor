"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signOut } from "@/lib/supabase/auth";

export function UserMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="relative text-sm">
      <button
        type="button"
        className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-medium text-white shadow-sm backdrop-blur transition hover:bg-white/20 focus-visible:ring-white/70 focus-visible:ring-offset-0"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {email ?? "Account"}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200/70 bg-white/95 p-2 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
          <Link
            href="/account"
            className="block rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Account settings
          </Link>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await signOut();
              })
            }
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            disabled={pending}
          >
            {pending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
