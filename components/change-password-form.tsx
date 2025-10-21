"use client";

import { useFormState, useFormStatus } from "react-dom";

type State = { error?: string; success?: boolean } | undefined;

export function ChangePasswordForm({ action }: { action: (formData: FormData) => Promise<State> }) {
  const [state, formAction] = useFormState<State, FormData>(async (_prev, formData) => action(formData), undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          New password
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Confirm password
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </div>
      {state?.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-600">Password updated.</p> : null}
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-75"
    >
      {status.pending ? "Updating…" : children}
    </button>
  );
}
