import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

interface TrendRecord
  extends Database["public"]["Tables"]["merch_trend_metrics"]["Row"] {
  merch_products: Pick<Database["public"]["Tables"]["merch_products"]["Row"], "asin" | "title" | "brand" | "image_url" | "url" | "bsr_category" | "price_cents"> | null;
}

export function TrendsList({ records }: { records: TrendRecord[] }) {
  if (!records.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        No trend metrics available yet. Run the crawl, embed, and metrics jobs to populate the dashboard.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-100/80 dark:bg-slate-900/80">
          <tr>
            <Th>Rank</Th>
            <Th>Product</Th>
            <Th>Momentum</Th>
            <Th>BSR now</Th>
            <Th>BSR Δ 24h</Th>
            <Th>BSR Δ 7d</Th>
            <Th>Reviews Δ</Th>
            <Th>Rating</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
          {records.map((record, index) => {
            const product = record.merch_products;
            return (
              <tr key={record.asin} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                <td className="px-4 py-3 font-semibold text-slate-500">{index + 1}</td>
                <td className="px-4 py-3">
                  {product ? (
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.title ?? product.asin}
                          className="h-14 w-14 rounded-md border border-slate-200 object-contain dark:border-slate-700"
                        />
                      ) : null}
                      <div className="space-y-1">
                        <Link href={`/products/${record.asin}`} className="line-clamp-2 font-medium text-slate-900 hover:underline dark:text-slate-100">
                          {product.title ?? record.asin}
                        </Link>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{product.brand ?? ""}</p>
                        {product.bsr_category ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">
                            {product.bsr_category}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-300">{record.asin}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Progress value={(record.momentum ?? 0) * 100} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{record.bsr_now ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">{formatDelta(record.bsr_now, record.bsr_24h)}</td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">{formatDelta(record.bsr_now, record.bsr_7d)}</td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">{formatDelta(record.reviews_now, record.reviews_24h)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{record.rating_now ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, value)).toFixed(0)}%` }} />
      </div>
      <span className="w-12 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">{value.toFixed(0)}%</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">{children}</th>;
}

function formatDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return "-";
  const diff = previous - current;
  if (diff === 0) return "0";
  const sign = diff > 0 ? "↓" : "↑";
  return `${sign} ${Math.abs(diff)}`;
}
