export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-deeper via-brand-dark to-brand px-4 dark:from-[#12053a] dark:via-[#1c0b4f] dark:to-[#2e1065]">
      <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/85 p-10 shadow-[0_35px_60px_rgba(46,16,101,0.35)] backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-white/10 dark:bg-slate-950/85 dark:shadow-[0_35px_60px_rgba(12,5,33,0.65)]">
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
