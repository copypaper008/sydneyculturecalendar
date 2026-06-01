import { NextRequest, NextResponse } from 'next/server'
import { fetchSLNSWEvents } from '@/lib/sync/sources/slnsw'
import { fetchMCAEvents } from '@/lib/sync/sources/mca'
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
  const [slnswEvents, mcaEvents] = await Promise.all([
    fetchSLNSWEvents(),
    fetchMCAEvents(),
  ])
  const result = await syncEvents([...slnswEvents, ...mcaEvents])
  return result
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
