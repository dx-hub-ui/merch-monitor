import "dotenv/config";
import { Client } from "pg";
import { computeMomentum } from "@/lib/metrics";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL must be set");
  }

  const pg = new Client({ connectionString });
  await pg.connect();

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

  await pg.end();
  console.log(JSON.stringify({ metricsUpserted: upserted }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
