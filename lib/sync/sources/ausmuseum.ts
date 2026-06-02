import { RawEvent } from '../types'

const BASE_URL = 'https://australian.museum'
const WHATS_ON_URL = `${BASE_URL}/visit/whats-on/`
const FETCH_TIMEOUT_MS = 15_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://australian.museum/',
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS }).finally(() => clearTimeout(timer))
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function extractEventPaths(html: string): string[] {
  const seen = new Set<string>()
  const paths: string[] = []
  // Match both absolute and relative href links to /visit/whats-on/anything
  // Be liberal: allow upper/lower, hyphens, digits, slashes (sub-paths)
  const re = /href="((?:https?:\/\/australian\.museum)?\/visit\/whats-on\/([^"/?#][^"?#]*))"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
    let path: string
    try {
      path = (raw.startsWith('http') ? new URL(raw).pathname : raw).replace(/\/$/, '')
    } catch { continue }
    if (path === '/visit/whats-on' || path === '/visit/whats-on/') continue
    if (!seen.has(path)) { seen.add(path); paths.push(path) }
  }
  console.log(`[ausmuseum] Listing page: ${html.length} chars, ${paths.length} paths`)
  return paths
}

async function scrapeEventPage(path: string, today: string): Promise<RawEvent | null> {
  const url = `${BASE_URL}${path}`
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) { console.log(`[ausmuseum] ${path}: HTTP ${res.status}`); return null }
    const html = await res.text()

    // Title
    const ogTitleM = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
    const title = ogTitleM
      ? decodeEntities(ogTitleM[1]).replace(/\s*[|\-–]\s*Australian Museum.*$/i, '').trim()
      : decodeEntities(stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? '')).trim()
    if (!title) { console.log(`[ausmuseum] ${path}: no title`); return null }

    // Description
    const descM = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/)
    const description = descM ? decodeEntities(descM[1]) : ''

    // Image
    const imgM = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    const image_url = imgM ? (imgM[1].startsWith('http') ? imgM[1] : `${BASE_URL}${imgM[1]}`) : null

    // Dates from JSON-LD
    let start_date: string | null = null
    let end_date: string | null = null
    const jsonLdBlocks = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? []
    for (const block of jsonLdBlocks) {
      const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
      try {
        const d = JSON.parse(inner)
        const items = Array.isArray(d) ? d : [d]
        for (const item of items) {
          if (item.startDate && !start_date) start_date = item.startDate.slice(0, 10)
          if (item.endDate && !end_date) end_date = item.endDate.slice(0, 10)
        }
      } catch { /* ignore */ }
      if (start_date) break
    }

    // Fallback: look for date patterns in visible text
    if (!start_date) {
      const MONTHS: Record<string, string> = {
        january: '01', february: '02', march: '03', april: '04',
        may: '05', june: '06', july: '07', august: '08',
        september: '09', october: '10', november: '11', december: '12',
      }
      const dateM = html.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
      if (dateM) {
        const month = MONTHS[dateM[2].toLowerCase()]
        if (month) start_date = `${dateM[3]}-${month}-${dateM[1].padStart(2, '0')}`
      }
    }

    // If no date, allow if page says "now on" / "permanent"
    const isOngoing = /\b(now on|now open|permanent collection|ongoing)\b/i.test(html)
    if (!start_date && !isOngoing) { console.log(`[ausmuseum] ${path}: no date`); return null }
    if (end_date && end_date < today) { console.log(`[ausmuseum] ${path}: past`); return null }

    const slug = path.split('/').filter(Boolean).pop()!
    const typeHint = html.toLowerCase()
    let event_type = 'other'
    if (typeHint.includes('exhibition')) event_type = 'exhibition'
    else if (typeHint.includes('talk') || typeHint.includes('lecture')) event_type = 'talk'
    else if (typeHint.includes('tour')) event_type = 'heritage'
    else if (typeHint.includes('performance')) event_type = 'performance'
    else if (typeHint.includes('festival')) event_type = 'festival'

    const is_free = /\bfree\b/i.test(html) && !/charges apply|buy ticket|ticketed/i.test(html)

    return {
      title,
      institution: 'Australian Museum',
      event_type,
      start_date: start_date ?? today,
      end_date: end_date ?? undefined,
      venue: 'Australian Museum',
      suburb: 'Sydney CBD',
      description: description || undefined,
      image_url: image_url ?? undefined,
      event_url: url,
      is_free,
      tags: ['australian-museum', is_free ? 'free' : 'ticketed'],
      source: 'ausmuseum',
      source_id: slug,
    }
  } catch (err) {
    console.log(`[ausmuseum] ${path}: fetch error ${err}`)
    return null
  }
}

export async function fetchAustralianMuseumEvents(): Promise<RawEvent[]> {
  let html: string
  try {
    const res = await fetchWithTimeout(WHATS_ON_URL)
    if (!res.ok) {
      console.error(`[ausmuseum] Listing page returned ${res.status}`)
      return []
    }
    html = await res.text()
  } catch (err) {
    console.error('[ausmuseum] Failed to fetch listing page:', err)
    return []
  }

  const paths = extractEventPaths(html)
  if (paths.length === 0) {
    console.error('[ausmuseum] No event paths found in listing page')
    return []
  }

  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []
  const seen = new Set<string>()

  for (const path of paths.slice(0, 30)) {
    const slug = path.split('/').filter(Boolean).pop()!
    if (seen.has(slug)) continue
    seen.add(slug)
    const event = await scrapeEventPage(path, today)
    if (event) events.push(event)
  }

  console.log(`[ausmuseum] Returning ${events.length} events`)
  return events
}
