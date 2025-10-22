import "dotenv/config";
import { Client } from "pg";
import { computeMomentum } from "@/lib/metrics";

type SnapshotRow = {
  term: string;
  alias: string;
  page: number;
  position: number;
  asin: string;
  bsr: number | null;
  reviews: number | null;
  rating: number | null;
  price_cents: number | null;
  title: string | null;
  brand: string | null;
  is_merch: boolean;
  product_type: string | null;
  fetched_at: string;
};

type KeywordSetting = {
  weight_reviews: number;
  weight_bsr: number;
  weight_merch: number;
  weight_rating: number;
  weight_diversity: number;
};

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL must be set");
  }

  const pg = new Client({ connectionString });
  await pg.connect();

  const trendMetrics = await updateTrendMetrics(pg);
  const keywordMetrics = await updateKeywordMetrics(pg);

  await pg.end();
  console.log(JSON.stringify({ trendMetrics, keywordMetrics }));
}

async function updateTrendMetrics(pg: Client) {
  const { rows } = await pg.query(
    `
    with latest as (
      select asin, bsr, reviews_count, rating, captured_at
      from merch_products_history
      where captured_at >= timezone('utc', now()) - interval '7 days'
    ),
    now_values as (
      select distinct on (asin) asin, bsr, reviews_count, rating
      from latest
      order by asin, captured_at desc
    ),
    day_values as (
      select distinct on (asin) asin, bsr, reviews_count
      from latest
      where captured_at <= timezone('utc', now()) - interval '24 hours'
      order by asin, captured_at desc
    ),
    week_values as (
      select distinct on (asin) asin, bsr, reviews_count
      from latest
      where captured_at <= timezone('utc', now()) - interval '7 days'
      order by asin, captured_at desc
    )
    select
      p.asin,
      coalesce(n.bsr, p.bsr) as bsr_now,
      d.bsr as bsr_24h,
      w.bsr as bsr_7d,
      coalesce(n.reviews_count, p.reviews_count) as reviews_now,
      d.reviews_count as reviews_24h,
      w.reviews_count as reviews_7d,
      coalesce(n.rating, p.rating) as rating_now
    from merch_products p
    left join now_values n on n.asin = p.asin
    left join day_values d on d.asin = p.asin
    left join week_values w on w.asin = p.asin
  `
  );

  let upserted = 0;
  for (const row of rows) {
    const momentum = computeMomentum({
      bsr7d: row.bsr_7d,
      bsr24h: row.bsr_24h,
      bsrNow: row.bsr_now,
      reviews24h: row.reviews_24h,
      reviewsNow: row.reviews_now
    });

    await pg.query(
      `
      insert into merch_trend_metrics(asin, bsr_now, bsr_24h, bsr_7d, reviews_now, reviews_24h, reviews_7d, rating_now, momentum, updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,timezone('utc', now()))
      on conflict (asin) do update set
        bsr_now = excluded.bsr_now,
        bsr_24h = excluded.bsr_24h,
        bsr_7d = excluded.bsr_7d,
        reviews_now = excluded.reviews_now,
        reviews_24h = excluded.reviews_24h,
        reviews_7d = excluded.reviews_7d,
        rating_now = excluded.rating_now,
        momentum = excluded.momentum,
        updated_at = excluded.updated_at
    `,
      [
        row.asin,
        row.bsr_now,
        row.bsr_24h,
        row.bsr_7d,
        row.reviews_now,
        row.reviews_24h,
        row.reviews_7d,
        row.rating_now,
        momentum
      ]
    );
    upserted += 1;
  }

  return { upserted };
}

async function updateKeywordMetrics(pg: Client) {
  const date = new Date().toISOString().slice(0, 10);

  const settings = await pg.query<KeywordSetting>(
    `select weight_reviews, weight_bsr, weight_merch, weight_rating, weight_diversity from keyword_settings limit 1`
  );
  const weights = settings.rows[0] ?? {
    weight_reviews: 0.35,
    weight_bsr: 0.25,
    weight_merch: 0.2,
    weight_rating: 0.1,
    weight_diversity: 0.1
  };

  const snapshotQuery = await pg.query<SnapshotRow>(
    `
      with latest as (
        select term, alias, max(fetched_at) as fetched_at
        from keyword_serp_snapshot
        group by term, alias
      )
      select s.*
      from keyword_serp_snapshot s
      join latest l on l.term = s.term and l.alias = s.alias and l.fetched_at = s.fetched_at
    `
  );

  if (!snapshotQuery.rows.length) {
    return { upserted: 0 };
  }

  const grouped = new Map<string, SnapshotRow[]>();
  for (const row of snapshotQuery.rows) {
    const key = `${row.term}::${row.alias}`;
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  const aggregates = Array.from(grouped.entries()).map(([key, rows]) => computeMetricsForGroup(key, rows));

  const normalization = buildNormalization(aggregates);

  let upserted = 0;
  for (const aggregate of aggregates) {
    const competition =
      weights.weight_reviews * normalizeValue(aggregate.reviewsP80 ?? 0, normalization.reviewsMin, normalization.reviewsMax) +
      weights.weight_bsr * (1 - normalizeValue(aggregate.avgBsr ?? normalization.avgBsrMin, normalization.avgBsrMin, normalization.avgBsrMax)) +
      weights.weight_merch * (1 - (aggregate.shareMerch ?? 0)) +
      weights.weight_rating * normalizeValue(aggregate.ratingMean ?? 0, normalization.ratingMin, normalization.ratingMax) +
      weights.weight_diversity * (1 - normalizeValue(aggregate.diversity ?? 0, normalization.diversityMin, normalization.diversityMax));

    const momentum7d = await computeMomentumWindow(pg, aggregate.term, aggregate.alias, date, 7, aggregate.avgBsr);
    const momentum30d = await computeMomentumWindow(pg, aggregate.term, aggregate.alias, date, 30, aggregate.avgBsr);
    const opportunity = computeOpportunity(competition, momentum7d);

    await pg.query(
      `
        insert into keyword_metrics_daily(
          term, alias, date, avg_bsr, med_bsr, share_merch, avg_reviews, med_reviews, top10_reviews_p80, serp_diversity,
          price_iqr, difficulty, competition, opportunity, momentum_7d, momentum_30d, samples, intent_tags, updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,timezone('utc', now())
        )
        on conflict (term, alias, date) do update set
          avg_bsr = excluded.avg_bsr,
          med_bsr = excluded.med_bsr,
          share_merch = excluded.share_merch,
          avg_reviews = excluded.avg_reviews,
          med_reviews = excluded.med_reviews,
          top10_reviews_p80 = excluded.top10_reviews_p80,
          serp_diversity = excluded.serp_diversity,
          price_iqr = excluded.price_iqr,
          difficulty = excluded.difficulty,
          competition = excluded.competition,
          opportunity = excluded.opportunity,
          momentum_7d = excluded.momentum_7d,
          momentum_30d = excluded.momentum_30d,
          samples = excluded.samples,
          intent_tags = excluded.intent_tags,
          updated_at = excluded.updated_at
      `,
      [
        aggregate.term,
        aggregate.alias,
        date,
        aggregate.avgBsr,
        aggregate.medBsr,
        aggregate.shareMerch,
        aggregate.avgReviews,
        aggregate.medReviews,
        aggregate.reviewsP80,
        aggregate.diversity,
        aggregate.priceIqr,
        Math.round(Math.min(100, Math.max(0, competition * 100))),
        competition,
        opportunity,
        momentum7d,
        momentum30d,
        aggregate.samples,
        aggregate.intentTags
      ]
    );
    upserted += 1;
  }

  return { upserted };
}

type GroupAggregate = {
  key: string;
  term: string;
  alias: string;
  avgBsr: number | null;
  medBsr: number | null;
  shareMerch: number | null;
  avgReviews: number | null;
  medReviews: number | null;
  reviewsP80: number | null;
  diversity: number | null;
  priceIqr: number | null;
  ratingMean: number | null;
  samples: number;
  intentTags: string[];
};

function computeMetricsForGroup(key: string, rows: SnapshotRow[]): GroupAggregate {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const top10 = sorted.slice(0, 10);
  const reviews = top10.map((row) => row.reviews ?? 0).filter((value) => value > 0);
  const ratings = top10.map((row) => row.rating ?? 0).filter((value) => value > 0);
  const bsrs = top10.map((row) => row.bsr ?? 0).filter((value) => value > 0).sort((a, b) => a - b);
  const prices = top10.map((row) => row.price_cents ?? 0).filter((value) => value > 0).sort((a, b) => a - b);
  const brands = top10.map((row) => row.brand ?? "unknown");
  const shareMerch = top10.length ? top10.filter((row) => row.is_merch).length / top10.length : 0;

  return {
    key,
    term: rows[0].term,
    alias: rows[0].alias,
    avgBsr: mean(bsrs),
    medBsr: median(bsrs),
    shareMerch,
    avgReviews: mean(reviews),
    medReviews: median(reviews),
    reviewsP80: percentile(reviews, 0.8),
    diversity: brandEntropy(brands),
    priceIqr: interquartileRange(prices),
    ratingMean: mean(ratings),
    samples: rows.length,
    intentTags: []
  };
}

function buildNormalization(aggregates: GroupAggregate[]) {
  const reviews = aggregates.map((agg) => agg.reviewsP80 ?? 0);
  const avgBsr = aggregates.map((agg) => agg.avgBsr ?? 0);
  const rating = aggregates.map((agg) => agg.ratingMean ?? 0);
  const diversity = aggregates.map((agg) => agg.diversity ?? 0);

  return {
    reviewsMin: Math.min(...reviews, 0),
    reviewsMax: Math.max(...reviews, 1),
    avgBsrMin: Math.min(...avgBsr, 1),
    avgBsrMax: Math.max(...avgBsr, 1),
    ratingMin: Math.min(...rating, 0),
    ratingMax: Math.max(...rating, 5),
    diversityMin: Math.min(...diversity, 0),
    diversityMax: Math.max(...diversity, 5)
  };
}

function normalizeValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max === min) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

async function computeMomentumWindow(
  pg: Client,
  term: string,
  alias: string,
  date: string,
  windowDays: number,
  currentAvgBsr: number | null
): Promise<number | null> {
  if (currentAvgBsr == null) {
    return null;
  }

  const referenceDate = new Date(date);
  referenceDate.setDate(referenceDate.getDate() - windowDays);
  const cutoff = referenceDate.toISOString().slice(0, 10);
  const { rows } = await pg.query<{ avg_bsr: number | null }>(
    `select avg(avg_bsr) as avg_bsr from keyword_metrics_daily where term=$1 and alias=$2 and date between $3 and $4`,
    [term, alias, cutoff, date]
  );

  const baseline = rows[0]?.avg_bsr;
  if (!baseline || baseline === 0) {
    return null;
  }

  return (baseline - currentAvgBsr) / baseline;
}

function computeOpportunity(competition: number, momentum: number | null): number {
  const normalizedMomentum = momentum == null ? 0.5 : normalizeValue(momentum, -1, 1);
  const opportunity = (1 - competition) * normalizedMomentum * 100;
  return Math.round(Math.min(100, Math.max(0, opportunity)));
}

function mean(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function percentile(values: number[], percentile: number): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * percentile);
  return sorted[index];
}

function interquartileRange(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  return q3 - q1;
}

function brandEntropy(brands: string[]): number | null {
  if (!brands.length) {
    return null;
  }
  const counts = new Map<string, number>();
  for (const brand of brands) {
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const total = brands.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / total;
    entropy -= probability * Math.log(probability);
  }
  return entropy;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
