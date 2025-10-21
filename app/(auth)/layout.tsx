export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-10 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">MW</div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Merch Watcher</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitor Merch on Demand performance in one dashboard.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
