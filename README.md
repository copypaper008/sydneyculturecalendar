# Culture Calendar

A city-agnostic platform for aggregating cultural events — exhibitions,
festivals, talks, performances, open days and heritage tours — from a city's
major institutions into one read-only discovery site (event list, month
calendar, year-at-a-glance timeline, institution pages).

Built with Next.js (App Router) + Supabase, deployed on Vercel with a nightly
sync cron. Full functional documentation lives in
[docs/PLATFORM_SPEC.md](docs/PLATFORM_SPEC.md).

## Branching model

| Branch | Role |
|---|---|
| `main` | The platform. City-agnostic code plus a **template** `config/site.ts` with placeholder values. |
| `sydney` | The Sydney deployment. Differs from `main` only in `config/site.ts`. |
| *`<city>`* | Each additional city gets its own long-lived branch on the same pattern. |

Platform changes land on `main` via PRs, then each city branch merges `main`
in. Because a city branch's only intended diff is its config file, those
merges are conflict-free unless the `SiteConfig` shape changed.

## Launching a new city

1. Branch from `main`: `git checkout -b <city> main`
2. Fill in every `TODO` in [`config/site.ts`](config/site.ts) — city identity
   (locale, IANA timezone), branding copy, theme, institutions, filter pills,
   business rules.
3. Add one source per institution feed — usually with one command:

   ```bash
   npm run add-source -- https://museum.example/whats-on \
     --institution "Example Museum" --suburb "Suburb" --save
   ```

   This probes the URL, picks a scraping strategy (event links on the listing
   page, sitemap, RSS, or WordPress API), extracts the events through the
   generic adapter, validates the output quality, and on a pass saves a
   declarative descriptor to `config/sources.ts`. Then list its key in
   `sync.sources`. Only sites the probe can't handle (fully JS-rendered, no
   feed/sitemap) need a hand-written adapter in `lib/sync/sources/` — build it
   on the shared toolkit in `lib/sync/scrape.ts`, register it in
   `lib/sync/sources/index.ts`. Sources are platform code — contribute them
   via a PR to `main`; only the *enabled list* is per-city.
4. Create a Vercel project for the city and set its **production branch** to
   the city branch. Configure env vars (below) and the cron secret.

## Configuration

| Env var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public read access. If unset, the site runs in demo mode from the bundled sample dataset (`data/seed.ts`, badged "Sample"). |
| `SUPABASE_SERVICE_ROLE_KEY` | Write key used by the sync engine. |
| `SYNC_SECRET` | Bearer token guarding `/api/sync`. On Vercel set `CRON_SECRET` to the same value. |
| `ALERT_WEBHOOK_URL` | Optional. Slack/Discord-compatible incoming webhook; the sync posts an alert when a source regresses (returns 0 events after being healthy, crashes, or fails validation). Run history is kept in the `sync_runs` table. |
| `BROWSER_WS_ENDPOINT` | Optional. Remote CDP websocket (e.g. a Browserless instance) used for `render: true` sources — JS-rendered sites scraped through a real browser. Recommended over a local binary on Vercel. |
| `CHROME_EXECUTABLE_PATH` | Optional. Local Chrome/Chromium binary for `render: true` sources (local dev). |

Database schema and bootstrap data: `supabase/migrations/`.

## Development

```bash
npm install
npm run dev    # demo mode unless Supabase env vars are set
npm run build
npx eslint .
```

Note: the bundled sample dataset is Sydney content; it powers demo mode on any
branch until replaced or until a database is configured.
