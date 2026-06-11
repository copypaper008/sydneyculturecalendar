# Culture Calendar — Platform Specification

This document describes everything the current **Sydney Culture Calendar** does, component by component and rule by rule, with the goal of extracting a **city-agnostic culture calendar platform**. For each part of the system it identifies:

- **Platform behaviour** — generic functionality that works for any city.
- **City content** — data that must be supplied per city (institutions, events, sources, branding).
- **Business rules** — editorial/data-quality rules currently baked into code that a new deployment must either adopt or make configurable.

---

## 1. Product overview

A public, read-only event-discovery website that aggregates cultural events (exhibitions, festivals, talks, performances, open days, heritage tours) from a city's major cultural institutions into one place. There are no user accounts, no bookings, and no payments — every event links out to the institution's official page and ticketing.

Core capabilities:

1. **Aggregation** — a nightly sync pipeline scrapes/fetches events from institution websites into a shared database, deduplicating per source.
2. **Discovery** — homepage with featured events and quick stats; searchable/filterable event list; month calendar; year-at-a-glance Gantt timeline; per-institution pages; event detail pages.
3. **Curation rules** — automatic exclusion of past, school-targeted, stale, and recurring-undated events; special handling of "ongoing/permanent" and "closing date TBA" exhibitions.
4. **Graceful degradation** — if no database is configured, the entire site runs from a bundled seed dataset (clearly badged as "Sample" content).

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server components for all pages; client components for interactive views |
| Styling | Tailwind CSS v4 (via PostCSS) + CSS custom properties + inline styles | Almost all styling is inline styles referencing design tokens in `globals.css`; Tailwind is installed but barely used. shadcn/ui primitives (button, badge, input, card, select) exist in `components/ui/` but are **unused** by the app |
| Icons | lucide-react | |
| Database | Supabase (Postgres) with `@supabase/supabase-js` | Public anon read via RLS; writes via service-role key from the sync job |
| Hosting | Vercel | Cron defined in `vercel.json` |
| Rendering/caching | ISR — every page exports `revalidate = 3600` (1 hour) | Event detail pages pre-generated via `generateStaticParams` |
| PWA | `public/manifest.json` | Standalone display, `start_url: /calendar`; icons referenced (`icon-192/512.png`) are **not present** in the repo |

Environment variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. If absent, site falls back to seed data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public read key |
| `SUPABASE_SERVICE_ROLE_KEY` | Write key for the sync engine (falls back to anon key) |
| `SYNC_SECRET` | Bearer token guarding `/api/sync`; on Vercel, `CRON_SECRET` must be set to the same value |

## 3. Data model

### 3.1 `events` table (`supabase/migrations/001_initial.sql`, `003_add_source_tracking.sql`)

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `title` | text | required |
| `institution` | text | required — free-text institution name (no FK; institutions are not a table) |
| `event_type` | enum | `exhibition · festival · talk · performance · open_day · heritage · other` |
| `start_date` | date | required, `YYYY-MM-DD` |
| `end_date` | date | nullable; CHECK `end_date >= start_date` |
| `start_time` / `end_time` | time | nullable; CHECK `end_time > start_time` |
| `venue`, `suburb` | text | nullable; suburb doubles as the locality label shown on cards |
| `description` | text | nullable |
| `image_url`, `event_url`, `ticket_url` | text | nullable |
| `is_free` | boolean | required, default false |
| `tags` | text[] | default `{}`. **The `ongoing` tag is semantically load-bearing** (see §7.2) |
| `search_vector` | tsvector | maintained by trigger over title+institution+venue+suburb+description+tags (GIN indexed) — **currently unused by the frontend**, which filters client-side |
| `source` | text | default `'manual'`; identifies the ingestion adapter (e.g. `mca`, `slnsw`) |
| `source_id` | text | external ID; unique index on `(source, source_id)` for dedup |
| `created_at` | timestamptz | default now() |

RLS: public `SELECT` only; no anonymous writes.

Indexes on start_date, end_date, institution, event_type, is_free, suburb.

### 3.2 TypeScript types (`lib/types.ts`)

- `Event` mirrors the table.
- `EVENT_TYPES` — display labels for the 7 types. **Platform-generic.**
- `INSTITUTIONS` — a hardcoded list of 13 Sydney institution names used to populate the institution filter dropdown. **City content** — note it is independent from what's in the DB; an institution present in events but missing here can't be selected in the dropdown (search still finds it).
- An `Institution` interface (name/suburb/website) exists but is unused — institutions are derived from event rows everywhere.

### 3.3 Seed data (`data/seed.ts`, `supabase/migrations/002_seed.sql`)

33 hand-written sample events (June–August 2026) across the 13 Sydney institutions, with Unsplash imagery. Identical content in two forms: TS array (frontend fallback when Supabase is unconfigured) and SQL insert (DB bootstrap). **City content** — a new city needs its own seed set, or none with DB required.

## 4. Routes & pages

All pages are server components, fetch via `getEvents()` / `getEventById()`, and revalidate hourly.

| Route | Page | What it does |
|---|---|---|
| `/` | Home | Hero (city name, tagline, background photo, CTAs to `/events` and `/calendar`); 4 discovery stat tiles; "Featured Events" (first 3 events from the sorted feed); "Browse by type" tiles with per-type counts |
| `/events` | All Events | Heading + `<EventList>` (client-side search/filter over the full event set) |
| `/events/[id]` | Event detail | Statically pre-generated per event; per-event SEO metadata; renders `<EventDetail>` plus up to 3 related events (same `event_type`, excluding itself, first 3 in feed order) |
| `/calendar` | Month calendar | `<CalendarView>` month grid |
| `/year` | Year timeline | `<YearCalendar>` Gantt of all institutions |
| `/institutions/[name]` | Institution page | Slug-matched (`toInstitutionSlug`: lowercase, strip apostrophes, non-alphanumerics → `-`); 404 when the institution has no current events; renders `<InstitutionView>` |
| `/api/sync` | Sync endpoint | GET (Vercel cron) and POST (manual), Bearer-token guarded; runs all source adapters and upserts (§8) |

Layout (`app/layout.tsx`): sticky `<NavBar>`, centered `<main>` (max-width 1180px), footer tagline. Loads Inter from Google Fonts; display font is Georgia/serif. Site title/description metadata and `themeColor #0f766e`. **City content:** title, description, footer text, hero copy/photo.

### Homepage discovery tiles — exact logic

| Tile | Count logic | Link |
|---|---|---|
| "Today in Sydney" | events where `start_date <= today <= end_date` (or single-day today) | `/events` (no param) |
| "This Weekend" | events active on the upcoming Saturday or Sunday (computed from `getDay()`) | `/events` |
| "Free This Week" | **all** free events (despite the label — no date window applied) | `/events?free=true` |
| "New Exhibitions" | **all** exhibitions (no recency window) | `/events?type=exhibition` |

> **Known gap:** the query params in these links (`?free=true`, `?type=…`) and the NavBar search (`/events?q=…`) are **never read** — `EventsPage`/`EventList` initialise filters to defaults and ignore `searchParams`. In a rebuilt platform, the events page should hydrate its filter state from the URL.

## 5. Components inventory

### 5.1 `NavBar` (client)
- Sticky, translucent (blur backdrop), 3-column grid (brand / nav links / search), collapsing to stacked rows under 860px.
- Brand text "Sydney Culture" → `/`. **City content.**
- Nav items: Events, Calendar, Year. Active state via `pathname.startsWith(href)` (underline + colour).
- Search input submits to `/events?q=…` (see known gap above).

### 5.2 `EventCard` (client)
The universal card used in every grid:
- Links to `/events/{id}`; hover changes border to primary colour.
- 16:9 image (plain `<img>`, not `next/image`) with neutral gradient placeholder if missing.
- Tag row: uppercase event type (underscores → spaces, accent colour); **provenance badge** — blue "Feed" when `source` exists and ≠ `manual`, pink "Sample" otherwise; green "Free" / neutral "Ticketed" pill from `is_free`.
- 2-line clamped serif title.
- Footer metadata: institution name; then either the literal word **"Ongoing"** (when tags include `ongoing`) or formatted date range (`en-AU`, "5 Jun – 30 Aug 2026"); appends ` · {suburb}`.

### 5.3 `FilterBar` (client) — exports `Filters` interface
Controls (all controlled inputs, parent owns state):
- Free-text search box.
- "Popular" quick-filter pills: Exhibitions, Festivals, Talks, Free, Performances — toggling sets/clears one filter key. **The pill list is an editorial choice** (which types a city wants to promote).
- Three native selects: event type (all 7), institution (from the hardcoded `INSTITUTIONS` list), free/ticketed/all.
- Date-from / date-to native date inputs.
- "Clear filters" reset link shown only when any filter is active.

### 5.4 `EventList` (client)
- Owns the `Filters` state (defaults: everything "all"/empty).
- Filter semantics (AND of all active filters):
  - **Search**: case-insensitive substring over a haystack of `title + institution + venue + suburb + description + tags` joined.
  - **Institution / type**: exact match.
  - **Free**: `free` ⇒ `is_free`; `paid` ⇒ `!is_free`.
  - **Date range**: compares **`start_date` only** against from/to (an exhibition already running before `dateFrom` is excluded — a deliberate-or-not rule to be decided in the rebuild).
- Shows result count; empty state ("No events found / Try adjusting your filters"); responsive 3/2/1-column card grid.

### 5.5 `CalendarView` (client) — month calendar
- State: year, month, selected day, single-select type filter.
- Header: "Today" button, prev/next month chevrons, month title; chip row "All" + the 7 event types (clicking an active chip resets to All).
- Grid: Sun-first weekday headers; fixed 110px row cells; leading blanks for the first weekday.
- An event appears on a day if `start_date <= day <= end_date`, or `start_date === day` when no end date (**no-end-date events appear only on their start day here** — different from the year view).
- Each cell: day number (today highlighted with a filled circle), up to 3 event titles, then "+N more".
- Clicking a day with events opens a detail panel below the grid: long-form date heading, list of events with institution, start time (HH:MM), "· Free" marker, each linking to the event page.

### 5.6 `YearCalendar` (client) — year Gantt timeline
The most rule-dense component:
- **Initial year** = the latest event start-year that is ≤ current year + 1 (so a dataset full of next-year events opens on next year).
- Year stepper (◀ year ▶); per-type colour-coded multi-select filter chips (at least one type must stay active).
- Colour coding per type: exhibition `#7c3aed`, festival `#f97316`, performance `#ec4899`, talk `#3b82f6`, open_day `#10b981`, heritage `#d97706`, other `#6b7280` (duplicated in `EventDetail`).
- Rows = institutions (alphabetical), grouped from the filtered events. Each row: deterministic-colour initials avatar (string-hash into a 10-colour palette — same algorithm duplicated in `InstitutionView`), institution name linking to its page, suburb.
- Timeline: 12 proportional month columns with alternating shading; a vertical "today" line (computed client-side post-mount to avoid SSR mismatch).
- **Three temporal states per event bar**:
  1. *Dated* (`end_date` present) — solid-border tinted bar spanning start→end, sub-label = formatted range.
  2. *Ongoing* (no `end_date` + `ongoing` tag) — diagonal-striped bar to 31 Dec, sub-label "Ongoing".
  3. *Closing TBA* (no `end_date`, no tag) — **dashed**-border bar drawn from start to *today*, sub-label "Closing TBA".
- Bars clamped to the year, min-width 0.8%; title shown when width > 3%, sub-label when > 7%.
- **Lane packing**: greedy interval scheduling per institution row; max 5 visible lanes, with a "+N more / Show less" expander per row.
- **Year-visibility rules** for an event in year *Y* (see §7.3 for the full set): dated events show in every year they span; ongoing events show from their start year onwards; closing-TBA events only in the current year or their start year; in the current year, definitively past events are hidden, and closing-TBA events older than 18 months are presumed closed and hidden.
- Hover tooltip (fixed-position, above the bar): type label, title, institution, date line ("Ongoing" / "Opens {date} · Closing date TBA" / range), Free/Ticketed.
- Footer tip banner; empty state per year.

### 5.7 `InstitutionView` (client)
- Header: large initials avatar (same hash palette as YearCalendar), "Institution" eyebrow, name, suburb (taken from its first event).
- Two-mode toggle: **Events** (date-sorted card grid with count and empty state) / **Year** (reuses `YearCalendar` scoped to this institution's events).

### 5.8 `EventDetail` (server-rendered presentational)
- Back link; full-width 21:9 hero image (gradient fallback).
- Two-column layout (stacking on mobile): left = type eyebrow, serif title, "About" description, tag pills; right = metadata card + action buttons.
- Metadata table rows (omitted when empty): Institution (links to institution page), Dates ("Permanent exhibition" when tagged ongoing, else long-form range), Time (12-hour formatted `start – end`), Venue, Suburb, Cost ("Free admission"/"Ticketed").
- Actions: "Official website" (primary, `event_url`) and "Get tickets" (secondary, `ticket_url`), both `target="_blank"`.
- **"When" mini-Gantt**: for ongoing events, an explanatory "Ongoing — visit anytime" banner instead; otherwise a single-bar timeline across the months the event spans (month headers show year when ≤ 4 months), bar in the event-type colour, red "today" marker when today falls within the rendered window, start/end date labels.
- "You may also like": up to 3 same-type events.

### 5.9 `components/ui/*` (button, badge, card, input, select)
Standard shadcn/ui + Radix primitives. **Currently dead code** — nothing imports them. A rebuild should either adopt them properly or drop them.

## 6. Data access layer (`lib/supabase.ts`)

`getEvents()`:
1. No Supabase configured → return **filtered** seed events.
2. Query: `select * from events where end_date is null or end_date >= today, order by start_date asc`.
3. On error/empty → fall back to filtered seed.
4. Apply the **display filter** (§7.1), then **interleave ongoing events** (§7.2).

`getEventById(id)`: single-row fetch (or seed lookup); applies the school-exclusion rule even on direct access, returning null (404) for excluded events.

## 7. Business rules (the heart of the platform)

These are the rules a new city must consciously adopt, change, or make configurable.

### 7.1 Display filter (applied to every event list)
1. **School exclusion** — any event whose title or description matches `\bschool\b` (case-insensitive) is hidden everywhere, including its detail page. *Editorial rule: the audience is general public, not school groups.*
2. **Past exclusion** — events with `end_date < today` are excluded (both in the DB query and re-checked client-side for the seed path).
3. **Staleness cutoff** — events with **no** end date that are **not** tagged `ongoing` and started more than **18 months ago** are presumed finished and hidden.

### 7.2 "Ongoing" semantics & interleaving
- The tag `ongoing` marks permanent/no-closing-date exhibitions. It changes display in five places: card date label ("Ongoing"), detail metadata ("Permanent exhibition"), detail "When" banner, year-view striped full-year bar, and year-view visibility (shown every year from its start).
- **Feed interleaving**: `getEvents()` separates ongoing from dated events, then re-merges by inserting one ongoing event after every 3 dated events (remainder appended). *Purpose: permanent exhibitions don't pile up at the top (oldest start dates) or vanish; they're sprinkled through the chronological feed.* This ordering also silently defines "Featured Events" (first 3) on the homepage.

### 7.3 Three-state end-date model
The platform deliberately distinguishes:
| State | Data shape | Year-view rendering | Year-view visibility |
|---|---|---|---|
| Dated | `end_date` set | solid bar start→end | every year spanned, hidden once past |
| Ongoing/permanent | no `end_date` + `ongoing` tag | striped bar → 31 Dec | start year onwards, always |
| Closing TBA | no `end_date`, no tag | dashed bar start→today | current year (subject to 18-month rule) or start year only |

### 7.4 Sync-time admission rules (`lib/sync/engine.ts`)
A scraped event is **skipped** when:
1. Title/description matches the school regex.
2. `end_date < today`.
3. No `end_date`, type is **not** exhibition or festival, and `start_date < today` (one-off past events; festivals/exhibitions can legitimately have started already).
4. `end_date < start_date` (would violate the DB constraint; logged as an error).

### 7.5 Upsert/dedup
- Identity = `(source, source_id)` (unique partial index). Existing rows are **updated** on: title, description, type, dates, times, venue, image, is_free, tags. Notably **not** updated: institution, suburb, event_url, ticket_url. New rows are inserted in full.
- **Deletion never happens automatically** — events that disappear from a source remain until their end_date passes (sources mitigate this, e.g. the Maritime adapter skips pages whose booking button says "Closed").

### 7.6 Provenance badging
Every card shows "Feed" (synced from a source) vs "Sample" (manual/seed). *Rule: never present sample content as real.*

## 8. Ingestion pipeline

### 8.1 Architecture
- `POST|GET /api/sync` (Bearer `SYNC_SECRET`) → runs **all source adapters in parallel** → concatenates results → `syncEvents()` upserts sequentially → returns `{ ok, inserted, updated, skipped, errors[] }`.
- Scheduled by Vercel cron daily at **02:00 UTC** (`vercel.json`).
- Adapter contract: `async fetchXxxEvents(): Promise<RawEvent[]>` where `RawEvent` = the event shape minus `id`/`created_at`, with `source` + `source_id` required and `event_url` required. Every adapter is fail-soft: any error returns `[]` and logs, never breaking the run.

### 8.2 Shared adapter techniques (the reusable toolkit)
All seven Sydney adapters are hand-rolled regex scrapers sharing recurring patterns that a platform should extract into a shared library:
- `fetchWithTimeout` (AbortController, 10–15s) with desktop-browser headers (one source uses a Googlebot UA to bypass bot blocking).
- HTML helpers: `stripTags`, `decodeEntities` (6 common entities).
- Date parsing: "14 June 2026" → ISO; date ranges with **year inference** for the start ("14 Nov – 2 Jan 2026" → roll start back a year when start > end); `DD.MM–DD.MM.YYYY` dotted format.
- Time parsing: 12h→24h, ranges, "6–11pm" (am/pm inferred for the start from the end).
- Metadata extraction ladder: `og:title` / `og:description` / `og:image` (both attribute orders, both quote styles) → JSON-LD (`startDate`/`endDate`/`description`/`@type`, incl. recursive descent) → `__NEXT_DATA__` blob (raw-string regex + parsed `pageProps` walk) → server-rendered marker elements → first meaningful `<p>` (skipping cookie/privacy/acknowledgement boilerplate) → visible-text date regexes ("closes/until/through {date}").
- **Event-type classification**: keyword heuristics over title+description+JSON-LD types+CMS categories (exhibition/display; talk/lecture/panel/author/workshop→talk; tour/walk/heritage; performance/concert/screening/film; festival; else other).
- **Free detection**: per-source heuristics, e.g. MCA status strings ("ticketed"/"no booking required"/"general admission"→paid); "free" present minus "charges apply / entry fees / Adult: $ / paid activities" counter-signals (handles "Infant: Free" traps).
- **Recurring/undated exclusion**: "every Thursday", "various dates", "ongoing" date strings → skip (no fixed date to calendar).
- **Permanent detection** (Australian Museum, Maritime): "permanent collection/display", `data-value="Permanent"`, permanent topic links → add the `ongoing` tag; a server-rendered dates element (`DatesEl`) is treated as canonical and overrides weaker signals.
- Caps to bound runtime: 20–40 detail pages per source.

### 8.3 Per-source strategies (city content — replace per city)
| Adapter | Institution | Strategy | Notable rules |
|---|---|---|---|
| `mca.ts` | Museum of Contemporary Art | **Undocumented JSON API** (`/api/query-whats-on/`) + per-event page scrape for description | `when`-string parser; label→type map; status→is_free map; skips recurring/various dates |
| `agnsw.ts` | Art Gallery of NSW | Scrape 2 listing pages (exhibitions + events); `<article data-startdate/enddate/location>` attributes; detail-page enrichment | price-summary text → is_free; card-label → type; cross-page dedup |
| `slnsw.ts` | State Library of NSW | Scrape what's-on listing → up to 20 event pages | skips online-only events (webinar/virtual); everything `is_free: true`; rich type-hint classification incl. JSON-LD @type + body text |
| `powerhouse.ts` | Powerhouse Museum | Listing → `/program/` pages; JSON-LD dates first | multi-venue → venue+suburb mapping (Ultimo/Parramatta/Castle Hill/Millers Point); skips recurring; "SAT 20 JUN" year inference (next year if past) |
| `ausmuseum.ts` | Australian Museum | What's-on listing → up to 30 pages; JSON-LD dates | "now on/permanent" allows missing dates → `ongoing` tag for endless exhibitions; start defaults to today |
| `maritime.ts` | National Maritime Museum | **Sitemap-first** (site is client-rendered Next.js), fallback to `_next/data/{buildId}` JSON | the most elaborate: 5-pass date extraction (JSON-LD → `__NEXT_DATA__` regex+walk → canonical `DatesEl` → visible text → "closes/until" phrases); permanent detection; "Closed" booking-button skip; priced-ticket counter-signals |
| `whiterabbit.ts` | White Rabbit Gallery | Scrape exhibitions listing (dotted dates `24.06–08.11.2026`, title from nearby headings) with **WordPress REST API and RSS fallbacks** for bot-blocked environments | always free, always `exhibition`, fixed tags |

Each adapter hardcodes: institution name, venue, suburb, base tags (slug + free/ticketed), source key. **These seven files are the bulk of the per-city work in any new deployment.**

## 9. Design system

Tokens in `globals.css` (`:root`), consumed via inline `style` props:

- **Colour**: ink `#151922`, muted `#667085`, line `#e6e1d8`, surface `#fffdf8` (warm cream), surface-soft `#f7f3ec`, primary teal `#0f766e` (+ dark `#0b5f58`, soft `#d9f3ef`), accent violet `#7c3aed`, free-badge mint `#b8f5e1`, ticketed-badge `#f3efe7`. **City-themeable.**
- **Type**: display = Georgia serif (headings, big numerals); body = Inter.
- **Layout**: max-width 1180px; radius 10/16/24px; two card shadows; 7-step spacing scale (.5–4.5rem).
- **Responsive grid classes**: `.cards-3` (3→2→1 cols at 860/540px), `.discovery-grid` (4→2), `.detail-grid` (sidebar→stacked), `.nav-grid` (search drops to its own row).
- Event-type colour map (§5.6) — duplicated in two components; should be a single token set.
- Accessibility touches present: ≥44px tap targets on primary actions, aria-labels on year steppers; (gaps: hover-only tooltips, inline-styles-only theming, plain `<img>`).

## 10. SEO / metadata / PWA

- Global metadata (title/description) + per-event and per-institution `generateMetadata`.
- PWA manifest: name/short-name/description/theme `#00796b` (note: **mismatches** the viewport themeColor `#0f766e`), `start_url: /calendar`, standalone, portrait; icon files missing.
- ISR (1h) everywhere; event pages statically enumerated at build.
- `next.config.ts`: image remote-pattern allowlist for Unsplash only (irrelevant in practice since `next/image` isn't used); explicit manifest Content-Type header; Turbopack root pin.

## 11. What a new city deployment must supply

**Content & configuration:**
1. City name, branding copy (nav brand, hero eyebrow/headline/sub, footer line, site metadata, manifest), hero photo, theme colours.
2. Institution list (for the filter dropdown) — ideally promoted from a hardcoded constant to DB-driven.
3. One source adapter per institution feed (or a manual-entry workflow), each defining: institution display name, venue/suburb defaults, base tags, free/type heuristics tuned to that site's markup.
4. Seed/sample events (optional) for DB-less demo mode.
5. Locale & timezone: date formatting is hardcoded to `en-AU`; "today" is computed from server/runtime time with no explicit timezone handling — a multi-city platform needs an explicit IANA timezone and locale per city.
6. Cron schedule and `SYNC_SECRET`.

**Business rules to confirm/configure per city** (currently hardcoded):
- School-event exclusion regex (or other audience filters).
- 18-month staleness cutoff for closing-TBA events.
- Ongoing-event interleave ratio (1 per 3).
- Sync admission rules (which types may start in the past).
- "Popular" quick-filter pill set; event-type taxonomy and colours (the 7-value DB enum makes the taxonomy semi-rigid — adding a type is a migration).
- Featured-events selection (currently just feed order — first 3).

**Known defects to fix in the rebuild** (documented so they aren't ported):
1. `/events` ignores URL query params (`q`, `type`, `free`) that NavBar and homepage links emit.
2. "Free This Week" / "New Exhibitions" counts have no date window.
3. Date-range filter compares start_date only (excludes already-running events).
4. Month calendar shows no-end-date multi-day events on their start day only (inconsistent with year view's closing-TBA treatment).
5. Manifest theme colour mismatch; missing PWA icons.
6. Duplicated constants (type colours, avatar palette/hash, entity decoding, date parsing) across components/adapters.
7. Full-text `search_vector` infrastructure exists but search is client-side substring matching; fine at ~100 events, won't scale.
8. Sync upsert never deletes or expires events removed at the source, and doesn't update `event_url`/`ticket_url` on existing rows.
