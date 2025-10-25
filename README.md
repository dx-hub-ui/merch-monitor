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
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_BASIC=price_basic
STRIPE_PRICE_PRO=price_pro
# Supabase service role key is required for cron jobs/webhooks
SUPABASE_SERVICE_ROLE_KEY=...
# optional crawler overrides
MAX_ITEMS=500
USE_BEST_SELLERS=true
ZGBS_PAGES=5
ZGBS_PATHS=/Best-Sellers/zgbs
USE_SEARCH=true
SEARCH_PAGES=2
SEARCH_CATEGORY=fashion-mens-tshirts
SEARCH_SORT=review-rank
SEARCH_RH=n:7141123011
SEARCH_KEYWORDS="merch hoodie,retro tee"
HIDDEN_INCLUDE="official"
HIDDEN_EXCLUDE="adult"
```

Each key listed above overrides the admin-configured crawler settings. Omit a variable to keep the stored value.

Boolean overrides are case-insensitive (`true`/`false`), numeric overrides are clamped to the allowed ranges (1–20 for pagination,
50–5000 for `MAX_ITEMS`), and array overrides accept comma- or newline-delimited values. Empty strings are treated as `null` so
the dashboard falls back to the stored defaults.

All command-line scripts use [`dotenv`](https://github.com/motdotla/dotenv) and automatically hydrate `process.env` from the nearest `.env` file, so keep your local environment file committed to disk before running crawls or background jobs.

## Database setup

Run the base migration against your Supabase database:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_product_type_and_crawler_settings.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_keywords.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_billing.sql
```

The migrations install `pgvector`, create the `merch_*` tables, history trigger, keyword intelligence schema, semantic search RPCs, and Row Level Security policies. They are idempotent and safe to reapply.

## Scripts

```bash
npm run dev        # Next.js dev server
npm run build      # Production build
npm run start      # Start compiled app
npm run crawl      # Playwright crawler inserting/updating merch_products
npm run embed      # Generate OpenAI embeddings for new/changed products
npm run metrics    # Compute momentum metrics from history snapshots
npm run keywords:suggest # Amazon autocomplete harvesting pipeline
npm run keywords:serp    # SERP crawler for queued keyword jobs
npm run keywords:embed   # Generate embeddings for keyword terms
npm run usage:reset       # Reset daily usage counters (cron safe)
npm run usage:reset:monthly # Reapply plan limits on the first day of the month
npm run test       # Run Vitest unit & integration suites
npm run test:e2e   # Playwright UI smoke tests (requires running dev server)
```

### Crawling

The crawler now combines admin-configured discovery rules, per-key environment overrides, and strict post-filtering to keep the dataset fail-closed:

- **Best Sellers & Search**: crawl Fashion/Novelty ZGBS categories and optional keyword searches (with `i`, `s`, `rh`, and hidden keyword filters). All candidate URLs are canonicalised to `https://www.amazon.com/dp/ASIN` before queuing.
- **Strict merch detection**: pages must sit within a Fashion/Novelty breadcrumb and expose one of the approved “Merch on Demand” signals (logo, badge/byline, seller info, manufacturer, or JSON-LD). Non-matching pages are discarded.
- **Variants**: twister data, `data-dp-url` attributes, and embedded JSON are scanned for additional ASINs; unseen variants are enqueued automatically.
- **BSR snapshots**: the crawler reads the Best Sellers Rank from both legacy and the new detail-bullets layouts so each crawl appends a `merch_products_history` record with up-to-date BSR data for downstream analysis. When Amazon temporarily hides the rank we preserve the most recent known BSR/category so the history chart continues to reflect real-world fluctuations rather than noisy gaps.
- **Persistence**: successful parses upsert `merch_products` and append a matching history record, updating `merch_flag_source` and the new `product_type` classification token (e.g. `hoodie`, `long-sleeve`, `tshirt`).
- **Safety**: ≥4s throttling, media blocking, and a single JSON summary (including the final effective settings) are emitted at the end of each run.

### Embeddings

`scripts/embed.ts` batches up to 64 products at a time, calls OpenAI `text-embedding-3-small`, and upserts vectors into `merch_embeddings`. Only products without embeddings (or updated since the last embedding run) are processed.

### Trend metrics

`scripts/metrics.ts` derives 24h/7d deltas from `merch_products_history`, computes the weighted momentum score, and upserts into `merch_trend_metrics`.

### Keyword intelligence

- `scripts/suggest.ts` performs breadth-first Amazon autocomplete expansion for seed keywords/aliases, dedupes using NFKC-normalised tokens, and persists both the suggestion stream and canonical keyword records.
- `scripts/serp.ts` ingests queued keyword jobs, crawls 2–5 SERP pages via Playwright (respecting ≥300 ms throttles plus jitter), verifies strict Merch-on-Demand signals on detail pages, and stores full snapshots in `keyword_serp_snapshot`.
- `scripts/metrics.ts` also aggregates the most recent snapshots into `keyword_metrics_daily`, applying competition/difficulty/opportunity scoring, entropy-based diversity, price IQR, and 7d/30d momentum deltas.
- `scripts/embed_keywords.ts` back-fills and refreshes OpenAI embeddings for keyword+alias strings so semantic expansion stays in sync with the autocomplete corpus.
- Keyword list management persists to `keyword_lists` and `keyword_list_items`, enabling private campaign sets, launch cohorts, and research groups per user. When those tables are missing (for example before running the `0004_keyword_lists` migration) the application now falls back to a read-only mode that surfaces a friendly message instead of surfacing Supabase `PGRST205` errors.

Every keyword exploration request (`POST /api/keywords/explore`) normalises input, merges autocomplete/semantic neighbours, classifies intent, enqueues SERP jobs for stale terms, and caches the response for ten minutes. Companion endpoints expose related terms, top opportunities, and SERP snapshots for dashboard pages.

### Running keyword scripts in GitHub Actions

The `Run keyword maintenance scripts` GitHub Actions workflow (`.github/workflows/run-keyword-scripts.yml`) makes it possible to execute `npm run keywords:serp` and the other maintenance scripts without shell access to the Supabase backend. Supply the scripts as a comma- or newline-delimited list (for example `keywords:serp, metrics`) and they will run sequentially in the same job. Configure the following repository secrets so the workflow can authenticate:

- `SUPABASE_DB_URL` – Postgres connection string with read/write access.
- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL used by service role clients.
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key for Supabase RPCs.
- `OPENAI_API_KEY` – Required when running embedding scripts.

Once the secrets are in place you can:

1. Navigate to **Actions → Run keyword maintenance scripts** and trigger a manual run via **Run workflow**. Enter the scripts you want to run as a comma- or newline-separated list (for example `keywords:serp, metrics`) or accept the default `keywords:serp` run.
2. Allow the default cron schedule (`0 6 * * *`) to run nightly. Edit the `schedule` block in the workflow file if you need a different cadence or want to disable the timer.
3. Override the Node.js version when dispatching manually by filling in the optional `node-version` field.

The workflow installs dependencies with `npm ci`, provisions Playwright browsers automatically when a SERP crawl is requested, and iterates through the requested scripts in order while grouping logs for each invocation in the Actions UI.

## UI overview

- **Auth**: Email/password sign in & sign up. (CI/E2E can set `E2E_BYPASS_AUTH=true` to inject an admin session.)
- **Dashboard**: Search, sort, filter (including imagery-only, the product-type selector, and the BSR range slider with a quick reset), grid/table switcher, responsive layout, and numbered pagination with previous/next controls.
- **Keywords**: `/keywords/explore` unifies live expansion, difficulty/opportunity chips, SERP previews, and private keyword lists with clipboard export and multi-list management; `/keywords/top` for sortable daily opportunity rankings; `/keywords/[term]` for 30-day difficulty/momentum sparklines, top-10 SERP cards, and cross-linked related queries.
- **Dashboard modal**: Click any product row or card to open a quick-view modal with imagery, bullets, pricing, BSR (now backfilled from the latest trend metrics when snapshots are missing), reviews, outbound link helpers, and a selectable 30/60/90 day BSR history chart.
- **Trends**: Momentum board with BSR/reviews deltas and semantic search panel.
- **Product detail**: Product metadata, historical charts (BSR/reviews/price), similar items via pgvector.
- **Admin / Crawler**: Admin-only control panel for discovery rules with environment override indicators and reset-to-defaults action. The API now falls back to default settings with an `x-error` header when Supabase returns a missing session so anonymous health checks succeed without compilation warnings.
- **Account**: Change password and sign out.
- **Header navigation**: Persistent links to Dashboard, Trends, and the Keywords intelligence suite (plus the admin Crawler when applicable) across desktop and mobile.

All pages are responsive, accessible, and support dark mode via the header toggle. APIs respond from the Edge runtime; `/api/products` continues to return a JSON array of products but now includes pagination details in the `x-total-count` response header alongside the existing `x-plan-tier` entitlement header. On internal errors the handler falls back to an empty payload, annotates the response with `x-error`, and emits `x-total-count: 0` so clients can reliably detect failures without breaking legacy consumers.

### Mobile experience

- The sticky header now exposes a compact navigation toggle with Escape/overlay dismissal so primary routes remain reachable on smaller screens.
- Dashboard controls reflow into a touch-sized grid, imagery filters gain a tappable chip treatment, and tables fall back to the card/grid layout by default on phones.
- Wide tables (dashboard + trends) sit inside horizontal scroll containers, and the animated background relaxes its fixed attachment to avoid iOS scroll jank.

### Promote a user to admin

Crawler settings live behind the `/admin/crawler` route. To grant access, mark the Supabase user as an administrator—`lib/auth/roles.ts` accepts any of the metadata shapes below:

1. Open the Supabase project → **Authentication → Users**.
2. Select the account and edit metadata.
3. In **App metadata** or **User metadata**, set one of:
   - `{"is_admin": true}` (strings such as `"true"`/`"1"` also work)
   - `{"roles": ["admin"]}` (case-insensitive, e.g. `["Admin"]`)
   - `{"role": "admin"}` (case-insensitive)
4. Save the record and have the user sign out/in so their JWT refreshes.

Alternatively, run a SQL update against `auth.users` (adjusting the email filter as needed):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
where email = 'founder@example.com';
```

Once the new JWT propagates, the crawler settings form unlocks editing controls and the header shows the “Crawler” navigation item.

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
- Supabase role checks should always go through `supabase.auth.getUser()` (not `getSession()`) so the middleware and API routes only trust server-verified identity claims when determining admin access.
- Client components should import keyword types and helpers from `@/lib/keywords`, while server routes/actions pull data loaders from `@/lib/keywords/server` to avoid bundling the `next/headers` Supabase client into the browser build.
- API route helpers with shared parsing logic (such as the BSR range clamps) live in `lib/bsr.ts` so both request handlers and tests can import a single source of truth without breaking the Edge runtime export contract.

## Troubleshooting

- **Failed to parse cookie string**: Older Supabase sessions stored in the browser may be base64-prefixed (e.g. `base64-eyJ...`). Both the middleware and server helpers normalise these cookies—including variants that use URL-safe base64 characters—before they reach Supabase, so the error should disappear after your first request. If it persists, clear the `sb-*` cookies in your browser and try signing in again.
- **Dashboard shows zero products**: The dashboard client now explicitly includes authentication cookies with every API call. If you still see an empty table, verify that third-party cookie blocking or strict browser privacy modes are not stripping the Supabase session before the request reaches `/api/products`. The route responds with a JSON payload shaped like `{ products: ProductRow[]; total: number }`, so double-check that upstream proxies are not rewriting the body into an array-only payload.
- **Failed to parse URL from /api/...**: Server components now resolve the API base URL from `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `SITE_URL`, or the current `Host` header (falling back to `http://localhost:3000`). Set one of those variables in non-local environments to avoid misrouting fetches that previously tried to call relative URLs on the server.
- **Read-only server cookies**: When data loaders run in React Server Components, Next.js prevents cookie mutations. The Supabase helper swallows that specific runtime error so layouts can still render, but token refreshes will only occur when a Server Action or Route Handler runs.
- **Auth session missing**: Anonymous visitors (or expired sessions) previously surfaced a `AuthSessionMissingError`. The server-side session helper now treats that response as a normal signed-out state so pages can render without forcing a redirect loop, and middleware/Route Handlers swallow the same error instead of crashing when a session cookie is absent.
