import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";
import { load } from "cheerio";

const MAX_JOBS = 5;
const DEFAULT_SERP_PAGES = 3;
const MAX_SERP_PAGES = 5;
const DEFAULT_TOPN = 50;
const REQUEST_DELAY_MS = 400;
const REQUEST_JITTER_MS = 400;
const USER_AGENT =
  process.env.AMAZON_USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface KeywordJob {
  id: number;
  term: string;
  alias: string;
}

interface KeywordSettings {
  serpPages: number;
  topN: number;
}

interface SerpEntry {
  asin: string;
  title: string | null;
  brand: string | null;
  priceCents: number | null;
  rating: number | null;
  reviews: number | null;
  isMerch: boolean;
  page: number;
}

function normaliseAlias(value: string | null | undefined): string {
  if (!value) {
    return "default";
  }
  return value.toLowerCase();
}

function parsePriceCents(priceWhole: string | null, priceFraction: string | null): number | null {
  if (!priceWhole) return null;
  const whole = priceWhole.replace(/[^0-9]/g, "");
  if (!whole) return null;
  const fractionDigits = priceFraction?.replace(/[^0-9]/g, "") ?? "";
  const sanitizedFraction = fractionDigits === "" ? "0" : fractionDigits;
  const paddedFraction = sanitizedFraction.padEnd(2, "0").slice(0, 2);
  return parseInt(whole, 10) * 100 + parseInt(paddedFraction, 10);
}

function parseRating(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

function parseReviews(value: string | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

async function fetchSerpPage(term: string, page: number): Promise<SerpEntry[]> {
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", term);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`Amazon SERP request failed with status ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const results: SerpEntry[] = [];

  $("div.s-result-item[data-asin]").each((_, element) => {
    const asin = $(element).attr("data-asin");
    if (!asin) return;

    const title = $(element).find("h2 a span").first().text().trim() || null;
    const brand = $(element).find("h5 span, span.a-size-base-plus.a-color-base").first().text().trim() || null;
    const priceWhole = $(element).find("span.a-price-whole").first().text() || null;
    const priceFraction = $(element).find("span.a-price-fraction").first().text() || null;
    const ratingText = $(element).find("span.a-icon-alt").first().text() || null;
    const reviewsText = $(element)
      .find("span.a-size-base.s-underline-text, span.a-size-base.s-underline-text.a-text-bold")
      .first()
      .text() || null;

    const cardText = $(element).text().toLowerCase();
    const isMerch = cardText.includes("merch on demand") || cardText.includes("merch-on-demand");

    results.push({
      asin,
      title,
      brand,
      priceCents: parsePriceCents(priceWhole, priceFraction),
      rating: parseRating(ratingText),
      reviews: parseReviews(reviewsText),
      isMerch,
      page
    });
  });

  return results;
}

async function loadSettings(pg: Client): Promise<KeywordSettings> {
  const { rows } = await pg.query<{
    serp_pages: number | null;
    topn: number | null;
  }>("select serp_pages, topn from keyword_settings order by updated_at desc limit 1");

  const row = rows[0];
  const serpPages = row?.serp_pages ?? DEFAULT_SERP_PAGES;
  const topN = row?.topn ?? DEFAULT_TOPN;

  return {
    serpPages: Math.min(Math.max(1, serpPages), MAX_SERP_PAGES),
    topN: Math.max(1, topN)
  };
}

async function fetchPendingJobs(pg: Client): Promise<KeywordJob[]> {
  const { rows } = await pg.query<KeywordJob>(
    `select id, term, alias
     from keyword_serp_queue
     where status = 'pending'
     order by priority desc, requested_at asc
     limit $1`,
    [MAX_JOBS]
  );
  return rows.map(row => ({ ...row, alias: normaliseAlias(row.alias) }));
}

async function markJob(pg: Client, id: number, status: string): Promise<void> {
  await pg.query("update keyword_serp_queue set status = $2 where id = $1", [id, status]);
}

async function storeSnapshot(
  pg: Client,
  job: KeywordJob,
  entries: SerpEntry[]
): Promise<number> {
  await pg.query("delete from keyword_serp_snapshot where term = $1 and alias = $2", [job.term, job.alias]);
  if (entries.length === 0) {
    return 0;
  }

  const values: string[] = [];
  const params: (string | number | boolean | Date | null)[] = [];

  const fetchedAt = new Date();

  entries.forEach((entry, index) => {
    const position = index + 1;
    const page = entry.page;
    values.push(
      `($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, $${params.length + 5}, $${
        params.length + 6
      }, $${params.length + 7}, $${params.length + 8}, $${params.length + 9}, $${params.length + 10}, $${params.length + 11}, $${
        params.length + 12
      })`
    );
    params.push(
      job.term,
      job.alias,
      page,
      position,
      entry.asin,
      entry.priceCents,
      entry.reviews,
      entry.rating,
      entry.title,
      entry.brand,
      entry.isMerch,
      fetchedAt
    );
  });

  await pg.query(
    `insert into keyword_serp_snapshot (term, alias, page, position, asin, price_cents, reviews, rating, title, brand, is_merch, fetched_at)
     values ${values.join(",")}`,
    params
  );

  return entries.length;
}

async function processJob(pg: Client, job: KeywordJob, settings: KeywordSettings): Promise<number> {
  await markJob(pg, job.id, "processing");

  const seen = new Set<string>();
  const collected: SerpEntry[] = [];

  for (let page = 1; page <= settings.serpPages && collected.length < settings.topN; page += 1) {
    const pageEntries = await fetchSerpPage(job.term, page);
    for (const entry of pageEntries) {
      if (!entry.asin || seen.has(entry.asin)) {
        continue;
      }
      seen.add(entry.asin);
      collected.push(entry);
      if (collected.length >= settings.topN) {
        break;
      }
    }

    const jitter = REQUEST_DELAY_MS + Math.floor(Math.random() * REQUEST_JITTER_MS);
    await delay(jitter);
  }

  const stored = await storeSnapshot(pg, job, collected);
  await markJob(pg, job.id, "completed");
  return stored;
}

async function main(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL must be set");
  }

  const pg = new Client({ connectionString });
  await pg.connect();

  try {
    const settings = await loadSettings(pg);
    const jobs = await fetchPendingJobs(pg);

    if (jobs.length === 0) {
      console.log(JSON.stringify({ jobsProcessed: 0, snapshotsInserted: 0 }));
      return;
    }

    let totalSnapshots = 0;
    for (const job of jobs) {
      try {
        const count = await processJob(pg, job, settings);
        totalSnapshots += count;
        console.log(`Processed keyword SERP job ${job.id} (${job.term}/${job.alias}) with ${count} entries`);
      } catch (error) {
        console.error(`Failed keyword SERP job ${job.id} (${job.term}/${job.alias})`, error);
        await markJob(pg, job.id, "error");
      }
    }

    console.log(JSON.stringify({ jobsProcessed: jobs.length, snapshotsInserted: totalSnapshots }));
  } finally {
    await pg.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
