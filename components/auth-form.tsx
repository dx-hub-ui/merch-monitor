"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

type AuthState = { error?: string } | undefined;

type Props = {
  action: (formData: FormData) => Promise<AuthState> | AuthState;
  submitLabel: string;
  footer: React.ReactNode;
  passwordAutoComplete?: string;
  passwordMinLength?: number;
};

export function AuthForm({ action, submitLabel, footer, passwordAutoComplete = "current-password", passwordMinLength = 6 }: Props) {
  const [state, formAction] = useFormState<AuthState, FormData>(async (_prev, formData) => action(formData), undefined);
  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={passwordMinLength}
          autoComplete={passwordAutoComplete}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}
      <SubmitButton>{submitLabel}</SubmitButton>
      <div className="text-sm text-slate-500 dark:text-slate-400">{footer}</div>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80 disabled:opacity-75"
    >
      {status.pending ? "Please wait…" : children}
    </button>
  );
}

export function SignupFooter() {
  return (
    <span>
      Already have an account? <Link className="text-brand" href="/login">Sign in</Link>.
    </span>
  );
}

export function LoginFooter() {
  return (
    <span>
      Need an account? <Link className="text-brand" href="/signup">Create one</Link>.
    </span>
  );
}
