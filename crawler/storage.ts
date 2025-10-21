import type { Client } from "pg";
import type { ParsedProduct, Product } from "@/lib/crawler";

export async function upsertProduct(pg: Client, product: Product) {
  await pg.query(
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
  `,
    [
      product.asin,
      product.title,
      product.brand,
      product.price_cents,
      product.rating,
      product.reviews_count,
      product.bsr,
      product.bsr_category,
      product.url,
      product.image_url,
      product.bullet1,
      product.bullet2,
      product.merch_flag_source,
      product.product_type
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
      product.bsr,
      product.bsr_category,
      product.merch_flag_source,
      product.product_type
    ]
  );
}

export async function saveParsedProduct(pg: Client, parsed: ParsedProduct) {
  if (!parsed.product) {
    return false;
  }
  await upsertProduct(pg, parsed.product);
  return true;
}
