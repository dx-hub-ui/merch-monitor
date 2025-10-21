import "dotenv/config";
import { Client } from "pg";
import OpenAI from "openai";

const BATCH_SIZE = 64;

function buildContent(row: any) {
  const parts = [row.title, row.brand, row.bullet1, row.bullet2].filter(Boolean);
  return parts.join(" \n");
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!connectionString || !openaiKey) {
    throw new Error("SUPABASE_DB_URL and OPENAI_API_KEY must be set");
  }

  const pg = new Client({ connectionString });
  await pg.connect();
  const openai = new OpenAI({ apiKey: openaiKey });

  const pending = await pg.query(
    `
    select p.asin, p.title, p.brand, p.bullet1, p.bullet2
    from merch_products p
    left join merch_embeddings e on e.asin = p.asin
    where e.embedding is null or e.updated_at < p.last_seen
    order by p.last_seen desc
  `
  );

  let processed = 0;

  for (let i = 0; i < pending.rows.length; i += BATCH_SIZE) {
    const slice = pending.rows.slice(i, i + BATCH_SIZE);
    const inputs = slice.map(row => buildContent(row));
    const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: inputs });
    for (let idx = 0; idx < slice.length; idx++) {
      const row = slice[idx];
      const embedding = response.data[idx]?.embedding;
      const content = buildContent(row);
      if (!embedding || !content) continue;
      const vector = `[${embedding.join(",")}]`;
      await pg.query(
        `
        insert into merch_embeddings(asin, content, embedding, updated_at)
        values($1, $2, $3::vector, timezone('utc', now()))
        on conflict (asin) do update set
          content = excluded.content,
          embedding = excluded.embedding,
          updated_at = excluded.updated_at
      `,
        [row.asin, content, vector]
      );
      processed += 1;
    }
  }

  await pg.end();
  console.log(JSON.stringify({ embeddingsProcessed: processed, totalPending: pending.rows.length }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
