"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import type { Database } from "@/lib/supabase/types";
import { clsx } from "clsx";
import { PRODUCT_TYPES } from "@/lib/crawler-settings";
import { ProductHistoryChart, type HistoryPoint } from "./product-history-chart";
import { BsrSlider } from "./bsr-slider";

const PAGE_SIZE = 40;
const BSR_DEFAULT_RANGE: [number, number] = [1, 500000];

type ProductRow = Database["public"]["Tables"]["merch_products"]["Row"];

type ApiResponse = { products: ProductRow[]; total: number };
type ProductDetailResponse = { product: ProductRow; history: HistoryPoint[] };

async function fetcher(url: string) {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    const errorHeader = res.headers.get("x-error");
    console.error("API error", errorHeader);
    return { products: [], total: 0 } as ApiResponse;
  }
  const json = await res.json();
  if (!json || typeof json !== "object") {
    return { products: [], total: 0 } as ApiResponse;
  }
  const products = Array.isArray((json as { products?: unknown }).products)
    ? ((json as { products: ProductRow[] }).products ?? [])
    : [];
  const total = typeof (json as { total?: unknown }).total === "number" ? (json as { total: number }).total : 0;
  return { products, total } as ApiResponse;
}

async function detailFetcher(url: string) {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? "Failed to load product detail");
  }
  return (await res.json()) as ProductDetailResponse;
}

export function DashboardClient() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"bsr" | "reviews" | "rating" | "last_seen">("bsr");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [withImages, setWithImages] = useState(false);
  const [productType, setProductType] = useState<string>("all");
  const [bsrRange, setBsrRange] = useState<[number, number]>(BSR_DEFAULT_RANGE);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "grid">(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      return "grid";
    }
    return "table";
  });

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      q: search,
      sort,
      dir: direction,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      withImages: withImages ? "true" : "false"
    });
    if (productType !== "all") {
      params.set("type", productType);
    }
    const isDefaultRange =
      bsrRange[0] === BSR_DEFAULT_RANGE[0] && bsrRange[1] === BSR_DEFAULT_RANGE[1];
    if (!isDefaultRange) {
      params.set("bsrMin", String(bsrRange[0]));
      params.set("bsrMax", String(bsrRange[1]));
    }
    return `/api/products?${params.toString()}`;
  }, [search, sort, direction, withImages, productType, bsrRange, page]);

  const { data, isLoading, isValidating } = useSWR<ApiResponse>(requestUrl, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false
  });

  useEffect(() => {
    setPage(current => (current === 1 ? current : 1));
  }, [search, sort, direction, withImages, productType, bsrRange[0], bsrRange[1]]);

  const products = useMemo(() => data?.products ?? [], [data]);
  const totalFromServer = data?.total ?? 0;
  const minimumTotal = (page - 1) * PAGE_SIZE + products.length;
  const inferredTotal = totalFromServer > 0 ? Math.max(totalFromServer, minimumTotal) : minimumTotal;
  const totalPages = Math.max(1, Math.ceil(Math.max(inferredTotal, totalFromServer) / PAGE_SIZE));
  const canGoPrevious = page > 1;
  const hasUnknownMore = totalFromServer === 0 && products.length === PAGE_SIZE;
  const canGoNext = page < totalPages || hasUnknownMore;
  const startItem = products.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endItem = (page - 1) * PAGE_SIZE + products.length;
  const isInitialLoading = isLoading && !data;

  useEffect(() => {
    if (!isInitialLoading && page > totalPages && !hasUnknownMore) {
      setPage(totalPages);
    }
  }, [isInitialLoading, page, totalPages, hasUnknownMore]);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  const handleSelectProduct = (product: ProductRow) => {
    setSelectedProduct(product);
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2 xl:col-span-3">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Product type
            <select
              value={productType}
              onChange={event => setProductType(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All types</option>
              {PRODUCT_TYPES.map(type => (
                <option key={type} value={type}>
                  {formatProductType(type)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2 xl:col-span-3">
            <span>BSR range</span>
            <BsrSlider value={bsrRange} onValueChange={setBsrRange} max={BSR_DEFAULT_RANGE[1]} />
            <div className="flex items-center justify-between text-xs font-normal text-slate-500 dark:text-slate-400">
              <span>Min {formatNumber(bsrRange[0])}</span>
              <button
                type="button"
                onClick={() => setBsrRange(BSR_DEFAULT_RANGE)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset
              </button>
              <span>Max {formatNumber(bsrRange[1])}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 sm:w-auto">
            <input
              type="checkbox"
              checked={withImages}
              onChange={event => setWithImages(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            With imagery only
          </label>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={clsx(
                "rounded-lg px-3 py-2 text-sm font-medium",
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
                "rounded-lg px-3 py-2 text-sm font-medium",
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
        {viewMode === "table" ? (
          <TableView products={products} loading={isInitialLoading} onSelect={handleSelectProduct} />
        ) : (
          <GridView products={products} loading={isInitialLoading} onSelect={handleSelectProduct} />
        )}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-100/70 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs sm:text-sm">
            {isValidating
              ? "Refreshing..."
              : products.length
              ? `Showing ${formatNumber(startItem)}–${formatNumber(endItem)} of ${formatNumber(inferredTotal)} products`
              : "No products found"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(current - 1, 1))}
              disabled={!canGoPrevious || isLoading}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80",
                !canGoPrevious || isLoading
                  ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Previous
            </button>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {totalFromServer > 0
                ? `Page ${formatNumber(page)} of ${formatNumber(totalPages)}`
                : `Page ${formatNumber(page)}`}
            </span>
            <button
              type="button"
              onClick={() => setPage(current => (canGoNext ? current + 1 : current))}
              disabled={!canGoNext || isLoading}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80",
                !canGoNext || isLoading
                  ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedProduct ? <ProductModal product={selectedProduct} onClose={handleCloseModal} /> : null}
    </div>
  );
}

function TableView({
  products,
  loading,
  onSelect
}: {
  products: ProductRow[];
  loading: boolean;
  onSelect: (product: ProductRow) => void;
}) {
  if (loading) {
    return <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" aria-label="Loading products" />;
  }
  return (
    <div className="w-full overflow-x-auto">
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
            <tr
              key={product.asin}
              onClick={() => onSelect(product)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(product);
                }
              }}
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:bg-slate-50/80 focus:outline-none focus-visible:bg-slate-100/80 dark:hover:bg-slate-900/40 dark:focus-visible:bg-slate-900/50"
            >
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
                      onClick={event => event.stopPropagation()}
                      className="line-clamp-2 font-medium text-slate-900 hover:underline dark:text-slate-100"
                    >
                      {product.title ?? product.asin}
                    </a>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ASIN {product.asin} · {formatProductType(product.product_type ?? "tshirt")}
                    </p>
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

function GridView({
  products,
  loading,
  onSelect
}: {
  products: ProductRow[];
  loading: boolean;
  onSelect: (product: ProductRow) => void;
}) {
  if (loading) {
    return <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" aria-label="Loading products" />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map(product => (
        <article
          key={product.asin}
          onClick={() => onSelect(product)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(product);
            }
          }}
          role="button"
          tabIndex={0}
          className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:-translate-y-0.5 focus-visible:shadow-lg dark:border-slate-800 dark:bg-slate-900/70"
        >
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title ?? product.asin}
              className="h-44 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-800"
            />
          ) : null}
          <div className="space-y-2">
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              className="line-clamp-2 text-lg font-semibold text-slate-900 hover:underline dark:text-slate-100"
            >
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
            <span>{formatProductType(product.product_type ?? "tshirt")}</span>
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

function ProductModal({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  const [range, setRange] = useState<30 | 60 | 90>(30);
  const {
    data: detail,
    isLoading,
    error
  } = useSWR<ProductDetailResponse>(`/api/products/${product.asin}?days=${range}`, detailFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false
  });

  const detailProduct = detail?.product ?? product;
  const history = detail?.history ?? [];

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${detailProduct.title ?? detailProduct.asin}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-2xl flex-col gap-6 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-transparent bg-slate-100 p-1 text-slate-600 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Close product details"
        >
          ✕
        </button>
        <div className="flex flex-col gap-5 sm:flex-row">
          {detailProduct.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detailProduct.image_url}
              alt={detailProduct.title ?? detailProduct.asin}
              className="h-56 w-full rounded-2xl border border-slate-200 object-contain dark:border-slate-800 sm:w-56"
            />
          ) : null}
          <div className="flex flex-1 flex-col gap-3">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{detailProduct.title ?? detailProduct.asin}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Brand: {detailProduct.brand ?? "Unknown"}</p>
            <dl className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">Price</dt>
                <dd>{formatPrice(detailProduct.price_cents)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">BSR</dt>
                <dd>{detailProduct.bsr ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">Reviews</dt>
                <dd>{detailProduct.reviews_count ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">Rating</dt>
                <dd>{detailProduct.rating ?? "-"}</dd>
              </div>
            </dl>
            {detailProduct.bsr_category ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Category: {detailProduct.bsr_category}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {detailProduct.bullet1 ? <p>{detailProduct.bullet1}</p> : null}
          {detailProduct.bullet2 ? <p>{detailProduct.bullet2}</p> : null}
        </div>
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Best Sellers Rank history</h3>
            <div className="flex gap-2">
              {[30, 60, 90].map(window => (
                <button
                  key={window}
                  type="button"
                  onClick={() => setRange(window as 30 | 60 | 90)}
                  className={clsx(
                    "rounded-full border px-3 py-1 text-sm font-medium transition",
                    range === window
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  Last {window} days
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">Failed to load history.</p>
            ) : isLoading && !detail ? (
              <div className="h-80 animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-800/40" aria-label="Loading history" />
            ) : history.length ? (
              <ProductHistoryChart history={history} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No history available for this range.</p>
            )}
          </div>
        </section>
        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center">
          <time dateTime={detailProduct.last_seen}>Last seen {new Date(detailProduct.last_seen).toLocaleString()}</time>
          <a
            href={detailProduct.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 font-medium text-white shadow transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80"
          >
            View listing
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

function formatPrice(price: number | null) {
  if (price == null) return "-";
  return `$${(price / 100).toFixed(2)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatProductType(type: string) {
  const map: Record<string, string> = {
    hoodie: "Hoodie",
    sweatshirt: "Sweatshirt",
    "long-sleeve": "Long sleeve",
    raglan: "Raglan",
    "v-neck": "V-neck",
    "tank-top": "Tank top",
    tshirt: "T-Shirt"
  };
  return map[type] ?? "T-Shirt";
}
