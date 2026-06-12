import { NextRequest, NextResponse } from 'next/server'
import { siteConfig } from '@/config/site'
import { sourceRegistry } from '@/lib/sync/sources'
import { syncEvents, getSupabaseAdmin } from '@/lib/sync/engine'
import { validateRawEvents } from '@/lib/sync/discovery/validate'
import {
  SourceRun, evaluateSourceHealth, loadPreviousCounts, recordSyncRuns, sendAlertWebhook,
} from '@/lib/sync/health'
import { closeBrowser } from '@/lib/sync/browser'

function isAuthorized(request: NextRequest): boolean {
  const syncSecret = process.env.SYNC_SECRET
  if (!syncSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token === syncSecret
}

async function runOneSource(key: string): Promise<SourceRun> {
  try {
    const events = await sourceRegistry[key]()
    // minEvents 1: an empty source is a health signal, handled separately
    const validation = validateRawEvents(events, { minEvents: 1 })
    const sync = await syncEvents(events)
    return { source: key, ok: true, fetched: events.length, validation, sync }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { source: key, ok: false, fetched: 0, validation: null, sync: null, error: message }
  }
}

async function runSync() {
  const enabled = siteConfig.sync.sources.filter((key) => {
    if (sourceRegistry[key]) return true
    console.error(`[sync] Unknown source "${key}" in siteConfig.sync.sources — skipping`)
    return false
  })

  let runs: SourceRun[]
  try {
    const settled = await Promise.allSettled(enabled.map(runOneSource))
    runs = settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { source: enabled[i], ok: false, fetched: 0, validation: null, sync: null, error: String(r.reason) },
    )
  } finally {
    // Render-mode sources share one browser instance per run
    await closeBrowser()
  }

  // ── Health: compare against history, persist, alert ─────────────────────────
  const supabase = getSupabaseAdmin()
  const previous = await loadPreviousCounts(supabase, enabled)
  const alerts = runs
    .map((run) => evaluateSourceHealth(run, previous[run.source]))
    .filter((a): a is NonNullable<typeof a> => a !== null)
  await recordSyncRuns(supabase, runs)
  const webhookSent = await sendAlertWebhook(alerts, siteConfig.brand.siteName)

  const totals = runs.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      inserted: acc.inserted + (r.sync?.inserted ?? 0),
      updated: acc.updated + (r.sync?.updated ?? 0),
      skipped: acc.skipped + (r.sync?.skipped ?? 0),
    }),
    { fetched: 0, inserted: 0, updated: 0, skipped: 0 },
  )

  return {
    ok: alerts.filter((a) => a.severity === 'regression').length === 0,
    totals,
    sources: runs.map((r) => ({
      source: r.source,
      ok: r.ok,
      fetched: r.fetched,
      inserted: r.sync?.inserted ?? 0,
      updated: r.sync?.updated ?? 0,
      skipped: r.sync?.skipped ?? 0,
      errors: [...(r.error ? [r.error] : []), ...(r.validation?.errors ?? []), ...(r.sync?.errors ?? [])],
      warnings: r.validation?.warnings ?? [],
    })),
    alerts,
    webhookSent,
  }
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runSync()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// GET — used by Vercel cron (sends Authorization: Bearer ${CRON_SECRET})
// CRON_SECRET should be set equal to SYNC_SECRET in Vercel env vars
export async function GET(request: NextRequest) {
  return handle(request)
}

// POST — for manual triggering
export async function POST(request: NextRequest) {
  return handle(request)
}
