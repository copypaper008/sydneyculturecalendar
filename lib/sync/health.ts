import { SupabaseClient } from '@supabase/supabase-js'
import { ValidationReport } from './discovery/validate'
import { SyncResult } from './engine'

/**
 * Per-source sync health: every run is validated and recorded, and
 * regressions (a previously healthy source going quiet or producing junk)
 * raise alerts. Scrapers rot silently — this is the smoke detector.
 *
 * Alerts are returned in the /api/sync response and, when ALERT_WEBHOOK_URL
 * is set, POSTed as JSON ({ text, content }) — compatible with Slack and
 * Discord incoming webhooks.
 */

export interface SourceRun {
  source: string
  /** Adapter completed without throwing. */
  ok: boolean
  fetched: number
  validation: ValidationReport | null
  sync: SyncResult | null
  error?: string
}

export interface HealthAlert {
  source: string
  severity: 'regression' | 'warning'
  message: string
}

/**
 * Pure alert logic, injected with the previous run's count for testability.
 * `previousFetched` is null when the source has no recorded history.
 */
export function evaluateSourceHealth(run: SourceRun, previousFetched: number | null): HealthAlert | null {
  if (!run.ok) {
    return { source: run.source, severity: 'regression', message: `adapter failed: ${run.error ?? 'unknown error'}` }
  }
  if (run.fetched === 0) {
    if (previousFetched !== null && previousFetched > 0) {
      return {
        source: run.source,
        severity: 'regression',
        message: `returned 0 events (previous run returned ${previousFetched}) — the site has probably changed`,
      }
    }
    return { source: run.source, severity: 'warning', message: 'returned 0 events' }
  }
  if (run.validation && !run.validation.pass) {
    return {
      source: run.source,
      severity: 'regression',
      message: `output failed validation: ${run.validation.errors.slice(0, 3).join('; ')}`,
    }
  }
  return null
}

/** Most recent recorded `fetched` count per source, before this run. */
export async function loadPreviousCounts(
  supabase: SupabaseClient,
  sources: string[],
): Promise<Record<string, number | null>> {
  const previous: Record<string, number | null> = Object.fromEntries(sources.map((s) => [s, null]))
  const { data, error } = await supabase
    .from('sync_runs')
    .select('source, fetched, run_at')
    .in('source', sources)
    .order('run_at', { ascending: false })
    .limit(sources.length * 5)
  if (error || !data) return previous
  for (const row of data) {
    if (previous[row.source] === null) previous[row.source] = row.fetched
  }
  return previous
}

export async function recordSyncRuns(supabase: SupabaseClient, runs: SourceRun[]): Promise<void> {
  const rows = runs.map((r) => ({
    source: r.source,
    ok: r.ok && (r.validation?.pass ?? false),
    fetched: r.fetched,
    inserted: r.sync?.inserted ?? 0,
    updated: r.sync?.updated ?? 0,
    skipped: r.sync?.skipped ?? 0,
    errors: [...(r.error ? [r.error] : []), ...(r.validation?.errors ?? []), ...(r.sync?.errors ?? [])],
    warnings: r.validation?.warnings ?? [],
  }))
  const { error } = await supabase.from('sync_runs').insert(rows)
  if (error) console.error('[health] failed to record sync runs:', error.message)
}

export async function sendAlertWebhook(alerts: HealthAlert[], siteName: string): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url || alerts.length === 0) return false
  const lines = alerts.map((a) => `• [${a.severity}] ${a.source}: ${a.message}`)
  const text = `⚠️ ${siteName} sync health — ${alerts.length} alert(s)\n${lines.join('\n')}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // "text" for Slack, "content" for Discord — harmless to send both
      body: JSON.stringify({ text, content: text }),
    })
    if (!res.ok) console.error(`[health] alert webhook → ${res.status}`)
    return res.ok
  } catch (err) {
    console.error('[health] alert webhook failed:', err)
    return false
  }
}
