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
# Public write token for Vercel Blob uploads (used for avatars)
BLOB_READ_WRITE_TOKEN=...
# optional crawler overrides
MAX_ITEMS_PER_RUN=600
USE_BEST_SELLERS=true
ZGBS_PAGES=5
ZGBS_PATHS=/Best-Sellers/zgbs
USE_NEW_RELEASES=true
NEW_PAGES=2
USE_MOVERS=true
MOVERS_PAGES=2
USE_SEARCH=true
SEARCH_PAGES=2
SEARCH_CATEGORY=fashion-mens-tshirts
SEARCH_SORT=review-rank
SEARCH_RH=n:7141123011
SEARCH_KEYWORDS="merch hoodie,retro tee"
HIDDEN_INCLUDE="official"
HIDDEN_EXCLUDE="adult"
RECRAWL_HOURS_P0=8
RECRAWL_HOURS_P1=18
RECRAWL_HOURS_P2=36
RECRAWL_HOURS_P3=96
PER_PAGE_DELAY_MS_MIN=1500
PER_PAGE_DELAY_MS_MAX=3000
PER_PRODUCT_DELAY_MS_MIN=4000
PER_PRODUCT_DELAY_MS_MAX=6000
```

Each key listed above overrides the admin-configured crawler settings. Omit a variable to keep the stored value.

Boolean overrides are case-insensitive (`true`/`false`), numeric overrides are clamped to the allowed ranges (Best Sellers pages: 1–10, search pages: 1–5, priority recrawl windows, and 100–5000 for `MAX_ITEMS_PER_RUN`), and array overrides accept comma- or newline-delimited values (multi-line `.env` entries are split the same way as the admin UI inputs). Empty strings are treated as `null` so the dashboard falls back to the stored defaults.

All command-line scripts use [`dotenv`](https://github.com/motdotla/dotenv) and automatically hydrate `process.env` from the nearest `.env` file, so keep your local environment file committed to disk before running crawls or background jobs.

## Billing & plans

- Authenticated users can review pricing and feature differences at `/plans`. The page highlights the Basic and Pro tiers, mirrors the entitlements configured in `lib/billing/plans.ts`, and links directly into the Stripe checkout flow for upgrades.
- The account screen’s **Upgrade to Pro** action now routes to the plans page so members can compare limits before committing to checkout.

## Database setup

Run the base migration against your Supabase database:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_product_type_and_crawler_settings.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_keywords.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_billing.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0005_profile_fields.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0006_crawler_queue_and_settings.sql
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
npm run jobs       # Run crawl → embed → metrics sequentially (self-hosted cron helper)
npm run jobs:dry-run # Print the job plan without executing scripts
npm run workflow   # Manually execute workflow presets (crawl or keyword maintenance)
npm run keywords:suggest # Amazon autocomplete harvesting pipeline
npm run keywords:serp    # SERP crawler for queued keyword jobs
npm run keywords:embed   # Generate embeddings for keyword terms
npm run usage:reset       # Reset daily usage counters (cron safe)
npm run usage:reset:monthly # Reapply plan limits on the first day of the month
npm run test       # Run Vitest unit & integration suites
npm run test:e2e   # Playwright UI smoke tests (requires running dev server)
```

## Development notes

- TypeScript project references now include the `components/` directory so ESLint and type-checking catch issues in shared UI components during `next lint` and `next build`.
- Avatar previews and profile photos use `next/image` to satisfy Next.js lint rules and ensure client previews (including `blob:` URLs) stay optimised. Reuse the existing utilities when adding new avatar surfaces.
- The E2E auth bypass path seeds a fully shaped Supabase user stub so `next build` type-checks succeed without requiring network calls to Supabase during automated runs.
- Momentum metrics clamp extreme positive review deltas to `1` and keep flat or negative growth at `0`, so write tests accordingly when expanding the scoring logic.

### Self-hosted scheduling

GitHub Actions runs (`crawl.yml`) can be blocked when an account exhausts its
included minutes or the organisation has a failed payment. Deployments that hit
those limits should fall back to a self-hosted scheduler:

1. Provision a small worker (or reuse an existing box) with Node.js 20 and the
   repository checked out.
2. Ensure the `.env` file contains the same credentials used in CI (database
   URL, OpenAI key, etc.).
3. Run `npm run jobs` from cron or a process manager. The helper wraps the
   crawler, embedding generator, and metrics scripts so a single invocation
   mirrors the Actions workflow. Use `npm run jobs -- --only=crawl` to target
   specific steps or `npm run jobs:dry-run` to confirm configuration without
   executing any network calls.

The job runner validates required environment variables up-front so failures
surface immediately instead of mid-crawl.

### Manual workflow execution

The `npm run workflow` helper mirrors the two GitHub workflow files so jobs can
be triggered locally or from a lightweight server without relying on Actions
minutes:

```bash
# Run the crawl/metrics pipeline. Modes map to the scheduled GitHub runs.
npm run workflow -- crawl --mode=high-frequency
npm run workflow -- crawl --mode=keyword-sweep
npm run workflow -- crawl --mode=backlog-touch

# Trigger keyword maintenance scripts sequentially.
npm run workflow -- keywords --scripts "keywords:serp,keywords:embed"

# Install Playwright browsers before running keywords.
npm run workflow -- keywords --install-playwright
```

All options can be combined with `--dry-run`, `--allow-missing-env`, or
`--only=...` to reuse the existing job runner flags. The helper applies the same
environment overrides that the GitHub YAML defines (for example `USE_SEARCH`
and `CRAWLER_RUN_MODE`), so a single command replicates the scheduled plans.

### Crawling

The crawler continuously monitors Amazon’s high-signal surfaces while enforcing a strict Merch-on-Demand predicate:

- **Discovery tiers**: Best Sellers, New Releases, Movers & Shakers, and filtered keyword searches all funnel into a single candidate set. Default discovery roots cover `/Best-Sellers/zgbs`, `/gp/new-releases`, and `/gp/movers-and-shakers` variants for US fashion/novelty plus the high-volume mens/womens/boys/girls T-shirt collections. Admins can trim or expand the lists, and every URL is canonicalised to `https://www.amazon.com/dp/ASIN` before deduplication.
- **Priority queue & cadences**: candidates are grouped into P0–P3 queues with admin-tunable recrawl windows (defaulting to 6–96 hour SLAs). A new `merch_crawl_state` table tracks `next_due`, content fingerprints, failure counts, and discovery provenance so recrawls honour backoff rules and freshness targets. A dedicated variant lane reserves ~10 % of each run for newly discovered ASINs while keeping long-tail P3 items on a slower cadence.
- **Strict merch detection**: listings must live within a Fashion or Novelty breadcrumb _and_ expose one of the approved Merch signals (logo art, “Merch on Demand” badges/sellers, manufacturer fields, or JSON-LD metadata). Pages that fail the predicate twice are automatically demoted and marked inactive.
- **Resilient listing fetches**: transient HTTP responses (429s/503s) now trigger an exponential backoff retry loop before a page is considered failed, dramatically reducing crawl gaps when Amazon briefly rate-limits requests.
- **Variant expansion**: twister payloads, `data-dp-url` hints, CSA attributes, and embedded JSON are harvested for child ASINs. Unseen variants are immediately enqueued behind their parent with reduced priority but a protected budget share, driving ≥60 % variant coverage on multi-option listings.
- **Persistence & logging**: successful parses upsert `merch_products`, append a `merch_products_history` snapshot, and emit a structured JSON log (insert/update action, queue level, freshness, merch flag source, and variant usage). A run-level summary reports candidate counts, priority consumption, skip totals, average fetch timings, and SLA conformance.
- **Resource discipline**: Playwright contexts block media, listing fetches jitter between 1.5–3 s, product fetches between 4–6 s, and discovery runs rotate surfaces rather than bursting a single category. Each product attempt allows two exponential-backoff retries for transient errors and drops immediately on CAPTCHA.
- **Schedule orchestration**: GitHub Actions runs the crawler every six hours for P0/P1/variant coverage, once per day for high-volume keyword sweeps, and three times per week for the long-tail backlog. Environment overrides can disable surfaces per run, and the summary JSON exposes per-priority freshness so SLA drift is visible in logs.

### Embeddings

`scripts/embed.ts` batches up to 64 products at a time, calls OpenAI `text-embedding-3-small`, and upserts vectors into `merch_embeddings`. Only products without embeddings (or updated since the last embedding run) are processed.

### Trend metrics

`scripts/metrics.ts` derives 24h/7d deltas from `merch_products_history`, computes the weighted momentum score, and upserts into `merch_trend_metrics`.

### Keyword intelligence

- `scripts/suggest.ts` performs breadth-first Amazon autocomplete expansion for seed keywords/aliases, dedupes using NFKC-normalised tokens, and persists both the suggestion stream and canonical keyword records.
- `scripts/serp.ts` ingests queued keyword jobs, walks 1–5 SERP pages with a throttled Amazon search scrape (respecting ≥300 ms delays plus jitter), applies a lightweight Merch-on-Demand text heuristic, and stores snapshots in `keyword_serp_snapshot` with a consistent batch timestamp for downstream metrics.
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
- **My profile**: `/profile` centralises avatar uploads (stored on Vercel Blob), display name updates, and timezone preferences with toast confirmations.
- **Navigation shell**: A collapsible sidebar with icon tooltips anchors Dashboard, Trends, Keywords, and (for admins) the Crawler, while the topbar mirrors the branding width, keeps space for future global search, and surfaces the avatar-powered user menu.

All pages are responsive, accessible, and support dark mode via the header toggle. APIs respond from the Edge runtime and return JSON objects (for example `{ products: [...], total: 123 }` for the dashboard feed); on internal errors the response body contains an empty dataset with an `x-error` header. The `/api/products` handler also preserves pagination metadata by always returning a `total` count and annotates successful responses with an `x-plan-tier` header for client gating.

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

Administrators also bypass all plan usage limits. Admin requests skip keyword quotas, saved list caps, historical lookback restrictions, and other plan-based feature toggles so internal teams can diagnose issues without upgrading their subscription metadata first.

Crawler discovery throttles now respect the same exemption: when an administrator updates `/admin/crawler`, the stored settings no longer enforce the 5,000-item, 10-page, or recrawl delay ceilings. Admin edits still honour the documented minimums and the environment override banner highlights any runtime clamps, but the Playwright worker now runs with the exact budgets configured in the UI.

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
- The server `getSession()` helper now returns only the server-verified Supabase user object and skips `supabase.auth.getSession()` entirely, eliminating runtime warnings about unauthenticated cookie data while preserving the existing call sites.
- Client components should import keyword types and helpers from `@/lib/keywords`, while server routes/actions pull data loaders from `@/lib/keywords/server` to avoid bundling the `next/headers` Supabase client into the browser build.
- API route helpers with shared parsing logic (such as the BSR range clamps) live in `lib/bsr.ts` so both request handlers and tests can import a single source of truth without breaking the Edge runtime export contract.

## Troubleshooting

- **Failed to parse cookie string**: Older Supabase sessions stored in the browser may be base64-prefixed (e.g. `base64-eyJ...`). The middleware, API route helpers, and server utilities now normalise these cookies—including variants that use URL-safe base64 characters—before they reach Supabase, so the warning should disappear after your first request. If it persists, clear the `sb-*` cookies in your browser and try signing in again.
- **Dashboard shows zero products**: The dashboard client now explicitly includes authentication cookies with every API call. If you still see an empty table, verify that third-party cookie blocking or strict browser privacy modes are not stripping the Supabase session before the request reaches `/api/products`. The route responds with a JSON payload shaped like `{ products: ProductRow[]; total: number }`, so double-check that upstream proxies are not rewriting the body into an array-only payload.
- **Failed to parse URL from /api/...**: Server components now resolve the API base URL from `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `SITE_URL`, or the current `Host` header (falling back to `http://localhost:3000`). Set one of those variables in non-local environments to avoid misrouting fetches that previously tried to call relative URLs on the server.
- **Read-only server cookies**: When data loaders run in React Server Components, Next.js prevents cookie mutations. The Supabase helper swallows that specific runtime error so layouts can still render, but token refreshes will only occur when a Server Action or Route Handler runs.
- **Auth session missing**: Anonymous visitors (or expired sessions) previously surfaced a `AuthSessionMissingError`. The server-side session helper now treats that response as a normal signed-out state so pages can render without forcing a redirect loop, and middleware/Route Handlers swallow the same error instead of crashing when a session cookie is absent.
