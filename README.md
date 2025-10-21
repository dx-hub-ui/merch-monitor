# Merch Watcher

Merch Watcher is a full-stack monitoring suite for Amazon Merch on Demand listings. It combines a Next.js 14 dashboard with Supabase storage, Playwright-powered crawling, OpenAI embeddings, and automated trend scoring jobs.

## Requirements

- Node.js 20+
- PostgreSQL/Supabase instance with the provided migration applied
- Supabase project configured with email/password auth
- OpenAI API key for embeddings

## Environment variables

Copy `.env.example` to `.env.local` (for Next.js) and `.env` (for scripts/CI) then provide:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_DB_URL=postgresql://postgres:service-role@db-host:6543/postgres
OPENAI_API_KEY=sk-...
MAX_ITEMS=500
ZGBS_PAGES=5
ZGBS_PATHS=/Best-Sellers/zgbs
```

The crawler honours `MAX_ITEMS`, `ZGBS_PAGES`, and optional comma-delimited `ZGBS_PATHS`.

All command-line scripts use [`dotenv`](https://github.com/motdotla/dotenv) and automatically hydrate `process.env` from the nearest `.env` file, so keep your local environment file committed to disk before running crawls or background jobs.

## Database setup

Run the base migration against your Supabase database:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
```

The migration installs `pgvector`, creates the `merch_*` tables, history trigger, semantic search RPC, and Row Level Security policies. It is idempotent and safe to reapply.

## Scripts

```bash
npm run dev        # Next.js dev server
npm run build      # Production build
npm run start      # Start compiled app
npm run crawl      # Playwright crawler inserting/updating merch_products
npm run embed      # Generate OpenAI embeddings for new/changed products
npm run metrics    # Compute momentum metrics from history snapshots
npm run test       # Run Vitest unit & integration suites
npm run test:e2e   # Playwright UI smoke tests (requires running dev server)
```

### Crawling

The crawler targets Amazon Best Seller (zgbs) paths and performs strict merch detection before upserting into the database. It throttles requests (≥4s between product fetches), blocks media, and emits JSON counters upon completion.

### Embeddings

`scripts/embed.ts` batches up to 64 products at a time, calls OpenAI `text-embedding-3-small`, and upserts vectors into `merch_embeddings`. Only products without embeddings (or updated since the last embedding run) are processed.

### Trend metrics

`scripts/metrics.ts` derives 24h/7d deltas from `merch_products_history`, computes the weighted momentum score, and upserts into `merch_trend_metrics`.

## UI overview

- **Auth**: Email/password sign in & sign up.
- **Dashboard**: Search, sort, filter (including imagery-only), grid/table switcher, responsive layout, infinite scroll.
- **Trends**: Momentum board with BSR/reviews deltas and semantic search panel.
- **Product detail**: Product metadata, historical charts (BSR/reviews/price), similar items via pgvector.
- **Account**: Change password and sign out.

All pages are responsive, accessible, and support dark mode via the header toggle. APIs respond from the Edge runtime and return arrays; on internal errors the response is an empty array with an `x-error` header.

## Visual design

The application adopts a violet-forward palette inspired by the shared concept art: a deep indigo to electric purple gradient envelopes each page, while surface elements float on soft, blurred glass panels. Interactive accents use the updated `brand` Tailwind color tokens (`brand.light`, `brand`, `brand.dark`, `brand.deeper`) so buttons, focus states, and charts inherit the new scheme automatically in both light and dark themes.

## Testing

- `npm run test:unit` covers crawler helpers, BSR parsing, and momentum scoring.
- `npm run test:integration` mocks Supabase clients for API route behaviour.
- `npm run test:e2e` executes Playwright UI smoke checks (requires running the dev server separately).

CI workflows run linting, tests, crawler, embedding, and metrics jobs. See `.github/workflows` for details.

## Development notes

- Remote product imagery is allowed via the configured `next.config.mjs` host patterns; no additional experimental flags are required because Server Actions are enabled by default in Next.js 14.
- If you change Supabase types, regenerate `lib/supabase/types.ts` with `supabase gen types typescript --linked` so that strongly typed API hooks continue to compile.

## Troubleshooting

- **Failed to parse cookie string**: Older Supabase sessions stored in the browser may be base64-prefixed (e.g. `base64-eyJ...`). Both the middleware and server helpers normalise these cookies before they reach Supabase, so the error should disappear after your first request. If it persists, clear the `sb-*` cookies in your browser and try signing in again.
