import { Client } from "pg";
import { collectFromSearch, parseProduct } from "../lib/crawler.js";

const KW = (process.env.KEYWORDS || "funny t-shirt,teacher shirt,halloween shirt").split(",");
const PAGES = parseInt(process.env.PAGES || "2", 10);

async function upsert(pg: Client, p: any){
  if(!p || !p.asin) return;
  await pg.query(`
    insert into merch_products(asin,title,brand,price_cents,rating,reviews_count,bsr,bsr_category,url,first_seen,last_seen)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
    on conflict (asin) do update set
      title=excluded.title, brand=excluded.brand, price_cents=excluded.price_cents,
      rating=excluded.rating, reviews_count=excluded.reviews_count,
      bsr=excluded.bsr, bsr_category=excluded.bsr_category, url=excluded.url,
      last_seen=now()
  `,[p.asin,p.title,p.brand,p.price_cents,p.rating,p.reviews_count,p.bsr,p.bsr_category,p.url]);
}

(async ()=>{
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await pg.connect();
  const seen = new Set<string>(); let saved=0;
  for(const kw of KW){
    const urls = await collectFromSearch(kw.trim(), PAGES);
    for(const u of urls){
      if(seen.has(u)) continue; seen.add(u);
      try {
        const rec = await parseProduct(u);
        if(rec){ await upsert(pg, rec); saved++; }
      } catch {}
      await new Promise(r=>setTimeout(r, 4000));
    }
  }
  await pg.end();
  console.log(JSON.stringify({ saved }));
})();
