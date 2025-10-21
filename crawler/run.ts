import { Client } from "pg";
import { collectFromZgbs, parseProduct } from "../lib/crawler.js";

const MAX_ITEMS = parseInt(process.env.MAX_ITEMS || "500", 10);       // target merch items to insert
const ZGBS_PAGES = parseInt(process.env.ZGBS_PAGES || "5", 10);       // pages per best-seller path

async function upsert(pg: Client, p: any) {
  if (!p || !p.asin) return;
  await pg.query(
    `
    insert into merch_products(
      asin,title,brand,price_cents,rating,reviews_count,bsr,bsr_category,url,image_url,bullet1,bullet2,merch_flag_source,first_seen,last_seen
    )
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
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
      last_seen=now()
  `,
    [
      p.asin,
      p.title,
      p.brand,
      p.price_cents,
      p.rating,
      p.reviews_count,
      p.bsr,
      p.bsr_category,
      p.url,
      p.image_url,
      p.bullet1,
      p.bullet2,
      p.merch_flag_source
    ]
  );
}

(async () => {
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await pg.connect();

  const candidates = await collectFromZgbs(MAX_ITEMS * 3, ZGBS_PAGES); // oversample, then filter
  const seen = new Set<string>();
  let saved = 0;

  for (const u of candidates) {
    if (seen.has(u)) continue; seen.add(u);
    try {
      const rec = await parseProduct(u);
      if (rec) { await upsert(pg, rec); saved++; }
    } catch {}
    await new Promise(r => setTimeout(r, 4000)); // throttle
    if (saved >= MAX_ITEMS) break;
  }

  await pg.end();
  console.log(JSON.stringify({ candidates: candidates.length, saved }));
})();
