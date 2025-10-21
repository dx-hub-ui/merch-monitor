import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchProductDetail } from "@/lib/supabase/queries";
import { ProductHistoryChart } from "@/components/product-history-chart";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { asin: string } }) {
  const detail = await fetchProductDetail(params.asin.toUpperCase());
  if (!detail) return { title: "Product not found • Merch Watcher" };
  return { title: `${detail.product.title ?? detail.product.asin} • Merch Watcher` };
}

export default async function ProductDetailPage({ params }: { params: { asin: string } }) {
  const asin = params.asin.toUpperCase();
  const detail = await fetchProductDetail(asin);
  if (!detail) {
    notFound();
  }

  const { product, history, similar } = detail;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr,1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <header className="flex flex-col gap-4 lg:flex-row">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.title ?? product.asin}
                className="h-56 w-full rounded-xl border border-slate-200 object-contain shadow-sm dark:border-slate-800 lg:w-60"
              />
            ) : null}
            <div className="flex flex-1 flex-col gap-3">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{product.title ?? product.asin}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-300">
                <span>Brand {product.brand ?? ""}</span>
                <span>ASIN {product.asin}</span>
                <span>BSR {product.bsr ?? "-"}</span>
                <span>{product.reviews_count ?? 0} reviews</span>
                <span>{product.rating ?? "-"}★</span>
                <span>{formatPrice(product.price_cents)}</span>
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {product.bullet1 ? <p>{product.bullet1}</p> : null}
                {product.bullet2 ? <p>{product.bullet2}</p> : null}
              </div>
              <div className="mt-auto flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span>Merch flag: {product.merch_flag_source ?? "Merch"}</span>
                <span>
                  Last seen <time dateTime={product.last_seen}>{new Date(product.last_seen).toLocaleString()}</time>
                </span>
                <Link href={product.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  View on Amazon
                </Link>
              </div>
            </div>
          </header>
          <section className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">History</h2>
            {history.length ? (
              <ProductHistoryChart history={history} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No history captured yet.</p>
            )}
          </section>
        </article>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Similar merch</h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Results based on pgvector embeddings and semantic similarity.
            </p>
            <div className="space-y-3">
              {similar.length ? (
                similar.map(item => (
                  <Link key={item.asin} href={`/products/${item.asin}`} className="block rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm hover:border-brand hover:shadow dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.asin}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{item.content}</p>
                    <span className="mt-1 block text-xs text-slate-400">Score {(item.score ?? 0).toFixed(3)}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No similar products yet. Run the embedding job.</p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Metadata</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">First seen</dt>
                <dd>{new Date(product.first_seen).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Last seen</dt>
                <dd>{new Date(product.last_seen).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Category</dt>
                <dd>{product.bsr_category ?? ""}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatPrice(price: number | null) {
  if (price == null) return "-";
  return `$${(price / 100).toFixed(2)}`;
}
