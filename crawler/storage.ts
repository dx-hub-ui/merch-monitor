import type { Client } from "pg";
import type { ParsedProduct, Product, PriorityLevel } from "@/lib/crawler";

export type CrawlState = {
  asin: string;
  priority: PriorityLevel;
  next_due: Date;
  last_hash: string | null;
  unchanged_runs: number;
  fail_count: number;
  last_seen_at: Date | null;
  inactive: boolean;
  discovery: string | null;
};

export type CrawlStateUpdate = {
  asin: string;
  priority: PriorityLevel;
  next_due: Date;
  last_hash: string | null;
  unchanged_runs: number;
  fail_count: number;
  inactive: boolean;
  discovery: string | null;
  last_seen_at: Date | null;
};

type ExistingSnapshot = {
  bsr: number | null;
  bsr_category: string | null;
  merch_flag_source: string | null;
  product_type: Product["product_type"] | null;
  last_seen: string | null;
  first_seen: string | null;
};

export function resolveSnapshotFields(existing: ExistingSnapshot | null, product: Product) {
  const resolvedBsr = product.bsr ?? existing?.bsr ?? null;
  const resolvedBsrCategory =
    product.bsr != null
      ? product.bsr_category ?? existing?.bsr_category ?? null
      : existing?.bsr_category ?? product.bsr_category ?? null;
  const resolvedMerchFlagSource = product.merch_flag_source ?? existing?.merch_flag_source ?? null;
  const resolvedProductType = product.product_type ?? existing?.product_type ?? product.product_type;

  return {
    bsr: resolvedBsr,
    bsr_category: resolvedBsrCategory,
    merch_flag_source: resolvedMerchFlagSource,
    product_type: resolvedProductType
  };
}

export type UpsertResult = {
  inserted: boolean;
};

export async function upsertProduct(pg: Client, product: Product): Promise<UpsertResult> {
  const { rows } = await pg.query<ExistingSnapshot>(
    `select bsr, bsr_category, merch_flag_source, product_type, last_seen, first_seen from merch_products where asin = $1 limit 1`,
    [product.asin]
  );
  const existing = rows[0]
    ? {
        ...rows[0],
        product_type: rows[0].product_type ?? null,
        last_seen: rows[0].last_seen,
        first_seen: rows[0].first_seen
      }
    : null;
  const snapshot = resolveSnapshotFields(existing, product);

  const { rows: upsertRows } = await pg.query<{ inserted: boolean }>(
    `
    insert into merch_products(
      asin,title,brand,price_cents,rating,reviews_count,bsr,bsr_category,url,image_url,bullet1,bullet2,merch_flag_source,product_type,first_seen,last_seen
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,timezone('utc', now()),timezone('utc', now())
    )
    on conflict (asin) do update set
      title=excluded.title,
      brand=excluded.brand,
      price_cents=excluded.price_cents,
      rating=excluded.rating,
      reviews_count=excluded.reviews_count,
      bsr=excluded.bsr,
      bsr_category=excluded.bsr_category,
      url=excluded.url,
      image_url=excluded.image_url,
      bullet1=excluded.bullet1,
      bullet2=excluded.bullet2,
      merch_flag_source=excluded.merch_flag_source,
      product_type=excluded.product_type,
      last_seen=timezone('utc', now())
      returning (xmax = 0) as inserted
  `,
    [
      product.asin,
      product.title,
      product.brand,
      product.price_cents,
      product.rating,
      product.reviews_count,
      snapshot.bsr,
      snapshot.bsr_category,
      product.url,
      product.image_url,
      product.bullet1,
      product.bullet2,
      snapshot.merch_flag_source,
      snapshot.product_type
    ]
  );

  await pg.query(
    `
    insert into merch_products_history(
      asin,price_cents,rating,reviews_count,bsr,bsr_category,merch_flag_source,product_type,captured_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,timezone('utc', now()))
  `,
    [
      product.asin,
      product.price_cents,
      product.rating,
      product.reviews_count,
      snapshot.bsr,
      snapshot.bsr_category,
      snapshot.merch_flag_source,
      snapshot.product_type
    ]
  );

  return { inserted: Boolean(upsertRows[0]?.inserted) };
}

export type SaveParsedProductResult = {
  saved: boolean;
  inserted: boolean;
};

export async function saveParsedProduct(pg: Client, parsed: ParsedProduct): Promise<SaveParsedProductResult> {
  if (!parsed.product) {
    return { saved: false, inserted: false };
  }
  const { inserted } = await upsertProduct(pg, parsed.product);
  return { saved: true, inserted };
}

export async function loadCrawlState(pg: Client): Promise<Map<string, CrawlState>> {
  const { rows } = await pg.query<{
    asin: string;
    priority: PriorityLevel;
    next_due: string;
    last_hash: string | null;
    unchanged_runs: number;
    fail_count: number;
    last_seen_at: string | null;
    inactive: boolean;
    discovery: string | null;
  }>(
    `select asin, priority, next_due, last_hash, unchanged_runs, fail_count, last_seen_at, inactive, discovery from merch_crawl_state`
  );

  const map = new Map<string, CrawlState>();
  for (const row of rows) {
    map.set(row.asin, {
      asin: row.asin,
      priority: row.priority,
      next_due: new Date(row.next_due),
      last_hash: row.last_hash,
      unchanged_runs: row.unchanged_runs ?? 0,
      fail_count: row.fail_count ?? 0,
      last_seen_at: row.last_seen_at ? new Date(row.last_seen_at) : null,
      inactive: row.inactive ?? false,
      discovery: row.discovery ?? null
    });
  }

  return map;
}

export async function persistCrawlState(pg: Client, update: CrawlStateUpdate) {
  await pg.query(
    `
    insert into merch_crawl_state(asin,priority,next_due,last_hash,unchanged_runs,fail_count,inactive,discovery,last_seen_at,updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,timezone('utc', now()))
    on conflict (asin) do update set
      priority=excluded.priority,
      next_due=excluded.next_due,
      last_hash=excluded.last_hash,
      unchanged_runs=excluded.unchanged_runs,
      fail_count=excluded.fail_count,
      inactive=excluded.inactive,
      discovery=excluded.discovery,
      last_seen_at=excluded.last_seen_at,
      updated_at=excluded.updated_at
  `,
    [
      update.asin,
      update.priority,
      update.next_due.toISOString(),
      update.last_hash,
      update.unchanged_runs,
      update.fail_count,
      update.inactive,
      update.discovery,
      update.last_seen_at ? update.last_seen_at.toISOString() : null
    ]
  );
}
