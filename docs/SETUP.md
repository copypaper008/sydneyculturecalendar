# Deployment & Operations Runbook

Step-by-step setup for a city deployment (written for the Sydney instance;
identical for any city branch). Companion to [PLATFORM_SPEC.md](PLATFORM_SPEC.md).

---

## 1. Supabase (demo or production)

The site runs without a database (demo mode from `data/seed.ts`, events badged
"Sample"), but live scraped data, sync history and health alerts all need
Supabase.

### 1.1 Create the project

1. Sign in at [supabase.com](https://supabase.com) → **New project**.
2. Pick any name (e.g. `culture-calendar-sydney`), generate a strong database
   password (you rarely need it again — the app uses API keys), and choose the
   region closest to the city (Sydney → `ap-southeast-2`). The free tier is
   fine for a demo.

### 1.2 Apply the migrations

**Easiest — one command from any computer** (no SQL editor, no copy-paste):

1. In Supabase: **Project Settings → Database → Connection string** and copy
   the **Session pooler** URI (the direct connection is IPv6-only on some
   plans). It embeds your database password — treat it as a secret.
2. In a checkout of this repo:

   ```bash
   npm install
   DATABASE_URL="postgresql://postgres.<ref>:<password>@…pooler.supabase.com:5432/postgres" \
     npm run db:migrate
   ```

   It applies every file in `supabase/migrations/` in order and prints a
   state check at the end (`✓ Fully migrated`). Safe to run repeatedly.

**Manual alternative — SQL editor** (desktop browser recommended; the editor
is unreliable on phones): open **SQL Editor** in the Supabase dashboard and
run the contents of each file, one at a time, in this order:

| # | File | What it does | Required? |
|---|---|---|---|
| 1 | `supabase/migrations/001_initial.sql` | `events` table, enum, RLS (public read), indexes, search trigger | **Yes** |
| 2 | `supabase/migrations/002_seed.sql` | 33 Sydney sample events | Optional — nice for a demo so the site isn't empty before the first sync. Sample rows have `source='manual'` and show a pink "Sample" badge; synced rows show "Feed". |
| 3 | `supabase/migrations/003_add_source_tracking.sql` | `source`/`source_id` columns + dedup index | **Yes** (sync breaks without it) |
| 4 | `supabase/migrations/004_sync_runs.sql` | `sync_runs` health-history table | **Yes** for health alerts |

Already have the project from before? You only need to run **004**.

> **All four migrations are idempotent** — re-running any of them is safe.
> 001 tolerates pre-existing objects, 002 only seeds when the `events` table
> is empty (never duplicates), 003/004 use `if not exists` throughout.
>
> **Troubleshooting — `ERROR: 42710: type "event_type" already exists`:**
> you're running a pre-idempotency copy of `001_initial.sql` against a
> project where it already (fully or partially) ran. Re-copy the current
> file from the repo and run it again — it now recovers cleanly from any
> partial state. To check where you stand at any point:
>
> ```sql
> select
>   exists (select 1 from pg_type where typname = 'event_type')                                          as enum_ok,
>   exists (select 1 from information_schema.tables  where table_name = 'events')                        as events_ok,
>   exists (select 1 from information_schema.columns where table_name = 'events'
>           and column_name = 'source')                                                                  as source_tracking_ok,
>   exists (select 1 from information_schema.tables  where table_name = 'sync_runs')                     as health_ok,
>   (select count(*) from events)                                                                        as event_count;
> ```

CLI alternative (instead of the SQL editor):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # ref is in the dashboard URL
npx supabase db push                                  # applies supabase/migrations/*
```

### 1.3 Collect the three keys

Dashboard → **Project Settings → API**:

| Copy this | Into env var | Notes |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe to expose; RLS limits it to reads |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Bypasses RLS; server-side only — never prefix with `NEXT_PUBLIC_` |

### 1.4 Wire up the env vars

Local dev — create `.env.local` (gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SYNC_SECRET=<any long random string>   # openssl rand -hex 32
```

Vercel — Project → **Settings → Environment Variables**, add the same four
**plus** `CRON_SECRET` set to the **same value as `SYNC_SECRET`** (Vercel's
cron sends `Authorization: Bearer $CRON_SECRET`; the route checks it against
`SYNC_SECRET`). Redeploy after adding env vars — they're baked in at build
time for the `NEXT_PUBLIC_*` ones.

### 1.5 First sync & verification

```bash
curl -X POST https://<your-deployment>/api/sync \
  -H "Authorization: Bearer $SYNC_SECRET" | jq
```

Expect a per-source breakdown (see §4). Then verify:

- the site shows events with blue **Feed** badges (live) alongside any pink
  **Sample** ones (seed);
- Supabase **Table Editor → sync_runs** has one row per source;
- the nightly cron (2:00 UTC, `vercel.json`) keeps it fresh — check
  Vercel → Project → **Logs** filtered to `/api/sync`.

> Note: pages cache for 1 hour (ISR), so freshly synced events can take up to
> an hour to appear.

---

## 2. Alert webhook (`ALERT_WEBHOOK_URL`) — optional

Get notified when a scraper rots (a source crashes, fails validation, or
returns 0 events after previously being healthy).

**Slack:** create an *Incoming Webhook* — [api.slack.com/apps](https://api.slack.com/apps)
→ Create New App → enable **Incoming Webhooks** → *Add New Webhook to
Workspace* → pick a channel → copy the `https://hooks.slack.com/services/…` URL.

**Discord:** Server Settings → **Integrations → Webhooks** → New Webhook →
pick a channel → *Copy Webhook URL*.

Then add `ALERT_WEBHOOK_URL=<that URL>` to Vercel env vars and redeploy.
The payload contains both `text` (Slack) and `content` (Discord) fields, so
either works unmodified.

To test delivery without breaking a scraper: temporarily add a bogus key to
`sync.sources` — no, don't; unknown keys are skipped. Easiest real test:
point `ALERT_WEBHOOK_URL` at the channel and wait for a genuine regression,
or run a one-off curl against the webhook to confirm the channel works:

```bash
curl -X POST "$ALERT_WEBHOOK_URL" -H 'Content-Type: application/json' \
  -d '{"text":"culture-calendar webhook test","content":"culture-calendar webhook test"}'
```

---

## 3. Browser rendering (`BROWSER_WS_ENDPOINT`) — only for `render: true` sources

Skip this until `npm run add-source` tells you a site needs rendering
(its descriptor gets `render: true`). Plain-HTTP sources never touch it.

**Hosted (recommended for Vercel):** create a free account at
[browserless.io](https://www.browserless.io), copy the websocket connection
URL (with your API token) from their dashboard, and set it as
`BROWSER_WS_ENDPOINT` in Vercel. Any provider exposing a Chrome DevTools
websocket works the same way.

**Self-hosted:** run Browserless/Chromium in Docker somewhere reachable:

```bash
docker run -d -p 3000:3000 ghcr.io/browserless/chromium
# BROWSER_WS_ENDPOINT=ws://<host>:3000
```

**Local dev:** skip the websocket and point at an installed browser instead:

```bash
# macOS example
CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npm run add-source -- https://js-heavy-site.example/whats-on --render --institution "X"
```

If a render-mode source runs with neither variable set, it falls back to
plain HTTP and logs a warning (usually yielding 0 events → which the health
check will then alert on).

---

## 4. `/api/sync` response shape (changed)

If anything external parses the sync response, update it. Old shape:

```json
{ "ok": true, "inserted": 12, "updated": 30, "skipped": 4, "errors": [] }
```

New shape — per-source breakdown plus health:

```json
{
  "ok": true,
  "totals": { "fetched": 58, "inserted": 12, "updated": 30, "skipped": 4 },
  "sources": [
    { "source": "mca", "ok": true, "fetched": 11, "inserted": 2, "updated": 9,
      "skipped": 0, "errors": [], "warnings": [] }
  ],
  "alerts": [
    { "source": "agnsw", "severity": "regression",
      "message": "returned 0 events (previous run returned 14) — the site has probably changed" }
  ],
  "webhookSent": true
}
```

`ok` is `false` whenever any source has a `regression`-severity alert, so a
plain HTTP/JSON monitor on the cron output also catches rot.

---

## 5. One-time pending step from the branching work

When PR #45 merges, `main` becomes the city-agnostic template. **Point the
Vercel project's production branch at `sydney`** (Vercel → Project →
Settings → Git → Production Branch) before or right after merging, then merge
`main` into `sydney` whenever the platform changes:

```bash
git checkout sydney && git merge main && git push
```
