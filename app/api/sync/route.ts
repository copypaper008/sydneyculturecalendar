import { NextRequest, NextResponse } from 'next/server'
import { siteConfig } from '@/config/site'
import { sourceRegistry } from '@/lib/sync/sources'
import { syncEvents } from '@/lib/sync/engine'

function isAuthorized(request: NextRequest): boolean {
  const syncSecret = process.env.SYNC_SECRET
  if (!syncSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token === syncSecret
}

async function runSync() {
  const enabled = siteConfig.sync.sources.filter((key) => {
    if (sourceRegistry[key]) return true
    console.error(`[sync] Unknown source "${key}" in siteConfig.sync.sources — skipping`)
    return false
  })

  // Adapters are fail-soft (they return [] on error), but guard anyway so one
  // rejected promise can't abort the whole run.
  const results = await Promise.allSettled(enabled.map((key) => sourceRegistry[key]()))
  const rawEvents = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value
    console.error(`[sync] Source "${enabled[i]}" failed:`, r.reason)
    return []
  })

  return syncEvents(rawEvents)
}

// GET — used by Vercel cron (sends Authorization: Bearer ${CRON_SECRET})
// CRON_SECRET should be set equal to SYNC_SECRET in Vercel env vars
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSync()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// POST — for manual triggering
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSync()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
