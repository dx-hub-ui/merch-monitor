"use client";

import { useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import type { Database } from "@/lib/supabase/types";
import { clsx } from "clsx";

const PAGE_SIZE = 40;

type ProductRow = Database["public"]["Tables"]["merch_products"]["Row"];

type ApiResponse = ProductRow[];

async function fetcher(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const errorHeader = res.headers.get("x-error");
    console.error("API error", errorHeader);
    return [];
  }
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json as ApiResponse;
}

export function DashboardClient() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"bsr" | "reviews" | "rating" | "last_seen">("bsr");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [withImages, setWithImages] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const getKey = (pageIndex: number, previousPageData: ApiResponse | null) => {
    if (previousPageData && previousPageData.length < PAGE_SIZE) return null;
    const params = new URLSearchParams({
      q: search,
      sort,
      dir: direction,
      limit: String(PAGE_SIZE),
      offset: String(pageIndex * PAGE_SIZE),
      withImages: withImages ? "true" : "false"
    });
    return `/api/products?${params.toString()}`;
  };

  const { data, isLoading, size, setSize, isValidating, mutate } = useSWRInfinite<ApiResponse>(getKey, fetcher, {
    revalidateFirstPage: true
  });

  useEffect(() => {
    setSize(1);
    mutate();
  }, [search, sort, direction, withImages, setSize, mutate]);

  const rows = useMemo(() => (data ? data.flat() : []), [data]);
  const hasMore = data ? data[data.length - 1]?.length === PAGE_SIZE : true;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Filter
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Title or brand"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              aria-label="Filter products"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Sort by
            <select
              value={sort}
              onChange={event => setSort(event.target.value as typeof sort)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="bsr">Best Sellers Rank</option>
              <option value="reviews">Reviews count</option>
              <option value="rating">Rating</option>
              <option value="last_seen">Last seen</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Direction
            <select
              value={direction}
              onChange={event => setDirection(event.target.value as typeof direction)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={withImages}
              onChange={event => setWithImages(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            With imagery only
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={clsx(
                "rounded-lg px-3 py-1 text-sm font-medium",
                viewMode === "table"
                  ? "bg-brand text-white shadow"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={clsx(
                "rounded-lg px-3 py-1 text-sm font-medium",
                viewMode === "grid"
                  ? "bg-brand text-white shadow"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        {viewMode === "table" ? <TableView products={rows} loading={isLoading && !data?.length} /> : <GridView products={rows} loading={isLoading && !data?.length} />}
        <div className="border-t border-slate-200 bg-slate-100/70 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
          {isValidating ? "Refreshing..." : `${rows.length} products`}
        </div>
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setSize(size + 1)}
          className="mx-auto mt-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Load more
        </button>
      ) : (
        <p className="mx-auto text-sm text-slate-500 dark:text-slate-400">End of results</p>
      )}
    </div>
  );
}

function TableView({ products, loading }: { products: ProductRow[]; loading: boolean }) {
  if (loading) {
    return <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" aria-label="Loading products" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-100/70 dark:bg-slate-900/80">
          <tr>
            <Th>Product</Th>
            <Th>Brand</Th>
            <Th>BSR</Th>
            <Th>Reviews</Th>
            <Th>Rating</Th>
            <Th>Price</Th>
            <Th>Last seen</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
          {products.map(product => (
            <tr key={product.asin} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
              <td className="max-w-[340px] whitespace-pre-line px-4 py-3">
                <div className="flex gap-3">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.title ?? product.asin}
                      className="h-16 w-16 rounded-md border border-slate-200 object-contain dark:border-slate-800"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="space-y-1">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 font-medium text-slate-900 hover:underline dark:text-slate-100"
                    >
                      {product.title ?? product.asin}
                    </a>
                    <p className="text-xs text-slate-500 dark:text-slate-400">ASIN {product.asin}</p>
                    {product.bsr_category ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        {product.bsr_category}
                      </span>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{product.brand ?? ""}</td>
              <td className="px-4 py-3 font-mono text-sm text-slate-800 dark:text-slate-200">{product.bsr ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{product.reviews_count ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{product.rating ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatPrice(product.price_cents)}</td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                <time dateTime={product.last_seen}>{new Date(product.last_seen).toLocaleString()}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridView({ products, loading }: { products: ProductRow[]; loading: boolean }) {
  if (loading) {
    return <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" aria-label="Loading products" />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map(product => (
        <article key={product.asin} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title ?? product.asin}
              className="h-44 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-800"
            />
          ) : null}
          <div className="space-y-2">
            <a href={product.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-lg font-semibold text-slate-900 hover:underline dark:text-slate-100">
              {product.title ?? product.asin}
            </a>
            <p className="text-sm text-slate-500 dark:text-slate-400">Brand: {product.brand ?? ""}</p>
            {product.bullet1 ? <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{product.bullet1}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>BSR {product.bsr ?? "-"}</span>
            <span>{product.reviews_count ?? 0} reviews</span>
            <span>{product.rating ?? "-"}★</span>
            <span>{formatPrice(product.price_cents)}</span>
          </div>
          <div className="mt-auto flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{product.merch_flag_source ?? "Merch"}</span>
            <time dateTime={product.last_seen}>{new Date(product.last_seen).toLocaleDateString()}</time>
          </div>
        </article>
      ))}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="sticky top-0 bg-slate-100/80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/80 dark:text-slate-300">{children}</th>;
}

function formatPrice(price: number | null) {
  if (price == null) return "-";
  return `$${(price / 100).toFixed(2)}`;
}
