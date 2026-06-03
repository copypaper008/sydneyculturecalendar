import { RawEvent } from '../types'

const BASE_URL = 'https://www.sea.museum'
const WHATS_ON_URL = `${BASE_URL}/en/whats-on`
const FETCH_TIMEOUT_MS = 12_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://www.sea.museum/',
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS }).finally(() => clearTimeout(timer))
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

/** Parse "14 March 2026" or "14 March" (with fallback year) into YYYY-MM-DD */
function parseDateStr(raw: string, fallbackYear?: string): string | null {
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/)
  if (!m) return null
  const month = MONTHS[m[2].toLowerCase()]
  if (!month) return null
  const year = m[3] ?? fallbackYear
  if (!year) return null
  return `${year}-${month}-${m[1].padStart(2, '0')}`
}

function parseTime(raw: string): string | null {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const mins = m[2] ?? '00'
  const period = m[3].toLowerCase()
  if (period === 'pm' && hours !== 12) hours += 12
  if (period === 'am' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${mins}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEvents(data: any): any[] {
  if (!data) return []
  // Next.js page props are nested — traverse to find arrays of event-like objects
  const results: any[] = []

  function walk(obj: any, depth = 0) {
    if (depth > 8 || !obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) {
        // Looks like an event if it has a title and a slug/url
        if (item && typeof item === 'object' && (item.title || item.heading) &&
            (typeof item.url === 'string' || typeof item.href === 'string' || item.slug)) {
          results.push(item)
        } else {
          walk(item, depth + 1)
        }
      }
    } else {
      for (const val of Object.values(obj)) {
        walk(val, depth + 1)
      }
    }
  }

  walk(data)
  return results
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToRawEvent(item: any, today: string): RawEvent | null {
  const title = decodeEntities(String(item.title ?? item.heading ?? '').trim())
  if (!title) return null

  // URL — slug may be an array in Next.js catch-all routes
  const rawSlug = item.slug
  const slugStr = Array.isArray(rawSlug) ? rawSlug.join('/') : String(rawSlug ?? '')
  const rawUrl = String(item.url ?? item.href ?? slugStr ?? '')
  const event_url = rawUrl.startsWith('http')
    ? rawUrl
    : rawUrl.startsWith('/')
      ? `${BASE_URL}${rawUrl}`
      : `${WHATS_ON_URL}/${rawUrl}`

  const slug = event_url.split('/').filter(Boolean).pop() ?? title.toLowerCase().replace(/\s+/g, '-')

  // Image
  let image_url: string | null = null
  const img = item.image ?? item.thumbnail ?? item.heroImage ?? item.featuredImage
  if (img) {
    const src = typeof img === 'string' ? img
      : typeof img === 'object' ? String(img.src ?? img.url ?? img.href ?? '') : ''
    if (src) image_url = src.startsWith('http') ? src : src ? `${BASE_URL}${src}` : null
  }

  // Dates
  let start_date: string | null = null
  let end_date: string | null = null

  const rawStart = item.startDate ?? item.start_date ?? item.dateFrom ?? item.eventStartDate ?? null
  const rawEnd = item.endDate ?? item.end_date ?? item.dateTo ?? item.eventEndDate ?? null

  if (rawStart) start_date = String(rawStart).slice(0, 10)
  if (rawEnd) end_date = String(rawEnd).slice(0, 10)

  // Fallback: parse from date strings in item
  if (!start_date) {
    const dateStr = item.date ?? item.when ?? item.dates ?? ''
    if (dateStr) {
      const d = parseDateStr(String(dateStr))
      if (d) start_date = d
    }
  }

  if (!start_date) return null
  if (end_date && end_date < today) return null

  // Times
  let start_time: string | null = null
  let end_time: string | null = null
  const timeStr = item.time ?? item.times ?? item.startTime ?? ''
  if (timeStr) {
    const timeRangeM = String(timeStr).match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–\-—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
    if (timeRangeM) {
      start_time = parseTime(timeRangeM[1])
      end_time = parseTime(timeRangeM[2])
    } else {
      start_time = parseTime(String(timeStr))
    }
  }

  // Event type
  const typeHint = String(item.type ?? item.category ?? item.eventType ?? item.label ?? '').toLowerCase()
  let event_type = 'other'
  if (typeHint.includes('exhibition')) event_type = 'exhibition'
  else if (typeHint.includes('talk') || typeHint.includes('lecture')) event_type = 'talk'
  else if (typeHint.includes('tour')) event_type = 'heritage'
  else if (typeHint.includes('performance')) event_type = 'performance'
  else if (typeHint.includes('festival')) event_type = 'festival'

  // Free
  const priceHint = String(item.price ?? item.cost ?? item.ticketType ?? item.admission ?? '').toLowerCase()
  const is_free = priceHint.includes('free') || item.isFree === true || item.free === true

  const description = decodeEntities(stripTags(String(item.description ?? item.summary ?? item.teaser ?? '')))

  return {
    title,
    institution: 'Australian National Maritime Museum',
    event_type,
    start_date,
    end_date: end_date ?? undefined,
    start_time: start_time ?? undefined,
    end_time: end_time ?? undefined,
    venue: 'Australian National Maritime Museum',
    suburb: 'Darling Harbour',
    description: description || undefined,
    image_url: image_url ?? undefined,
    event_url,
    is_free,
    tags: ['maritime-museum', is_free ? 'free' : 'ticketed'],
    source: 'maritime',
    source_id: slug,
  }
}

/** Try to extract event URLs from the sitemap */
async function fetchFromSitemap(): Promise<RawEvent[]> {
  const today = new Date().toISOString().split('T')[0]
  const sitemapUrls = [
    `${BASE_URL}/sitemap.xml`,
    `${BASE_URL}/en/sitemap.xml`,
    `${BASE_URL}/sitemap_index.xml`,
  ]

  let sitemapXml = ''
  for (const url of sitemapUrls) {
    try {
      const res = await fetchWithTimeout(url)
      console.log(`[maritime] sitemap ${url} → ${res.status}`)
      if (res.ok) { sitemapXml = await res.text(); break }
    } catch { /* skip */ }
  }

  if (!sitemapXml) {
    console.log('[maritime] No sitemap found')
    return []
  }

  // If this is a sitemap index, fetch the first child sitemap
  if (sitemapXml.includes('<sitemapindex')) {
    const childM = sitemapXml.match(/<loc>([^<]+)<\/loc>/)
    if (childM) {
      try {
        const res = await fetchWithTimeout(childM[1].trim())
        if (res.ok) sitemapXml = await res.text()
      } catch { /* skip */ }
    }
  }

  // Extract all /whats-on/ URLs from the sitemap
  const seen = new Set<string>()
  const paths: string[] = []
  const locRe = /<loc>([^<]*\/(?:en\/)?whats-on\/[^<]+)<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = locRe.exec(sitemapXml)) !== null) {
    const raw = m[1].trim()
    const path = raw.startsWith('http') ? new URL(raw).pathname.replace(/\/$/, '') : raw.replace(/\/$/, '')
    if (/^\/(?:en\/)?whats-on\/?$/.test(path)) continue
    if (!seen.has(path)) { seen.add(path); paths.push(path) }
  }
  console.log(`[maritime] Sitemap found ${paths.length} whats-on paths`)

  if (paths.length === 0) return []

  const events: RawEvent[] = []
  for (const path of paths.slice(0, 40)) {
    const slug = path.split('/').filter(Boolean).pop()!
    const url = `${BASE_URL}${path}`
    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) continue
      const pageHtml = await res.text()

      const titleM = pageHtml.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
      const title = titleM ? decodeEntities(titleM[1]).replace(/\s*[|\-–]\s*Australian National.*$/i, '').trim() : ''
      if (!title) continue

      const descM = pageHtml.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)
        ?? pageHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/)
        ?? pageHtml.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)
        ?? pageHtml.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/)
      const description = descM ? decodeEntities(descM[1]) : ''

      const imgM = pageHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      const image_url = imgM ? imgM[1] : null

      let start_date: string | null = null
      let end_date: string | null = null

      const jsonLdBlocks = pageHtml.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? []
      // Pass 1: prefer event/exhibition-typed blocks
      for (const block of jsonLdBlocks) {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
        try {
          const d = JSON.parse(inner)
          const items = Array.isArray(d) ? d : [d]
          for (const item of items) {
            const type = String(item['@type'] ?? '').toLowerCase()
            if (!type.includes('event') && !type.includes('exhibition')) continue
            if (item.startDate && !start_date) start_date = item.startDate.slice(0, 10)
            if (item.endDate && !end_date) end_date = item.endDate.slice(0, 10)
          }
        } catch { /* ignore */ }
        if (start_date) break
      }
      // Pass 2: fall back to any JSON-LD block that has startDate
      if (!start_date) {
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
      }
      const MONTH_ALT = 'January|February|March|April|May|June|July|August|September|October|November|December'

      // Pass 3: human-readable date in visible text (not ISO — too many false positives from scripts)
      if (!start_date) {
        const dateM = pageHtml.match(new RegExp(`(\\d{1,2})\\s+(${MONTH_ALT})\\s+(\\d{4})`, 'i'))
        if (dateM) {
          const month = MONTHS[dateM[2].toLowerCase()]
          if (month) start_date = `${dateM[3]}-${month}-${dateM[1].padStart(2, '0')}`
        }
      }

      // Pass 4: end date from "closes / until / open until / through / ends on" patterns
      // Run this even when start_date was found via JSON-LD, since endDate is often absent there
      if (!end_date) {
        const endRe = new RegExp(
          `(?:closes?|closing|until|open\\s+until|ends?\\s+on|through|concludes?)\\s+(\\d{1,2}\\s+(?:${MONTH_ALT})\\s+\\d{4})`,
          'i'
        )
        const endM = pageHtml.match(endRe)
        if (endM) {
          const d = parseDateStr(endM[1])
          if (d) end_date = d
        }
      }

      // Pass 5: date range "14 March – 31 August 2026" — captures end date even when start found via JSON-LD
      if (!end_date) {
        const rangeRe = new RegExp(
          `(\\d{1,2}\\s+(?:${MONTH_ALT})(?:\\s+\\d{4})?)\\s*[–\\-—]\\s*(\\d{1,2}\\s+(?:${MONTH_ALT})\\s+\\d{4})`,
          'i'
        )
        const rangeM = pageHtml.match(rangeRe)
        if (rangeM) {
          const endD = parseDateStr(rangeM[2])
          if (endD) {
            end_date = endD
            if (!start_date) {
              const fallbackYear = rangeM[2].match(/(\d{4})/)?.[1]
              const startD = parseDateStr(rangeM[1], fallbackYear)
              if (startD) start_date = startD
            }
          }
        }
      }

      console.log(`[maritime] ${slug}: start=${start_date} end=${end_date}`)

      // "Permanent" must appear as a phrase with a content word, not just in "permanent link" etc.
      // "now on" / "now open" are reliable museum idioms for currently-displayed work.
      const isOngoing = (
        /\bnow\s+on\b/i.test(pageHtml) ||
        /\bnow\s+open\b/i.test(pageHtml) ||
        /\bpermanent\s+(?:exhibition|collection|display|gallery|attraction|feature|installation)\b/i.test(pageHtml) ||
        /\bpermanent\b/i.test(title)
      )
      if (!start_date && !isOngoing) { console.log(`[maritime] ${slug}: no date`); continue }
      if (end_date && end_date < today) { console.log(`[maritime] ${slug}: past`); continue }
      // If the booking button says "Closed" and we still couldn't extract a future end date,
      // the exhibition has ended — skip it so deleted DB records don't get re-inserted
      if (!end_date && !isOngoing && />\s*Closed\s*<\/(?:button|a|span)>/i.test(pageHtml)) {
        console.log(`[maritime] ${slug}: booking closed, no end date found, skipping`)
        continue
      }

      const is_free = /\bfree\b/i.test(pageHtml) && !/ticketed|charges apply/i.test(pageHtml)
      const typeHint = (title + ' ' + description).toLowerCase()
      let event_type = 'exhibition'
      if (typeHint.includes('talk') || typeHint.includes('lecture')) event_type = 'talk'
      else if (typeHint.includes('tour')) event_type = 'heritage'
      else if (typeHint.includes('performance') || typeHint.includes('concert')) event_type = 'performance'
      // Only tag as ongoing if the page explicitly says so — don't use !end_date alone,
      // which would make every exhibit without a closing date span the whole year
      const isOngoingEvent = isOngoing && !end_date
      const tags = ['maritime-museum', is_free ? 'free' : 'ticketed']
      if (isOngoingEvent) tags.push('ongoing')

      events.push({
        title,
        institution: 'Australian National Maritime Museum',
        event_type,
        start_date: start_date ?? today,
        end_date: end_date ?? undefined,
        venue: 'Australian National Maritime Museum',
        suburb: 'Darling Harbour',
        description: description || undefined,
        image_url: image_url ?? undefined,
        event_url: url,
        is_free,
        tags,
        source: 'maritime',
        source_id: slug,
      })
    } catch { /* skip */ }
  }

  console.log(`[maritime] Sitemap approach returning ${events.length} events`)
  return events
}

export async function fetchMaritimeEvents(): Promise<RawEvent[]> {
  // Primary approach: sitemap — most reliable for JS-rendered Next.js sites
  const sitemapEvents = await fetchFromSitemap()
  if (sitemapEvents.length > 0) return sitemapEvents

  // Fallback: try _next/data API using buildId from the whats-on page
  let html: string
  try {
    const res = await fetchWithTimeout(WHATS_ON_URL)
    if (!res.ok) { console.error(`[maritime] Whats-on page returned ${res.status}`); return [] }
    html = await res.text()
  } catch (err) {
    console.error('[maritime] Failed to fetch page:', err)
    return []
  }

  const nextDataM = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!nextDataM) { console.error('[maritime] No __NEXT_DATA__ found'); return [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextData: any
  try { nextData = JSON.parse(nextDataM[1]) } catch { return [] }

  const buildId = nextData?.buildId
  if (!buildId) { console.error('[maritime] No buildId'); return [] }
  console.log(`[maritime] buildId: ${buildId}`)

  const candidateUrls = [
    `${BASE_URL}/_next/data/${buildId}/en/whats-on.json`,
    `${BASE_URL}/_next/data/${buildId}/en/whats-on.json?slug=whats-on`,
    `${BASE_URL}/_next/data/${buildId}/en/search.json`,
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pageApiData: any = null
  for (const dataUrl of candidateUrls) {
    try {
      const dataRes = await fetchWithTimeout(dataUrl)
      console.log(`[maritime] ${dataUrl} → ${dataRes.status}`)
      if (dataRes.ok) { pageApiData = await dataRes.json(); break }
    } catch { /* skip */ }
  }

  if (!pageApiData) { console.error('[maritime] All _next/data attempts failed'); return [] }

  const rawItems = extractEvents(pageApiData)
  console.log(`[maritime] Found ${rawItems.length} candidate items`)
  if (rawItems.length === 0) {
    console.log('[maritime] API sample:', JSON.stringify(pageApiData).slice(0, 300))
    return []
  }

  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []
  const seen = new Set<string>()
  for (const item of rawItems) {
    const event = mapToRawEvent(item, today)
    if (!event) continue
    if (seen.has(event.source_id)) continue
    seen.add(event.source_id)
    events.push(event)
  }

  console.log(`[maritime] Returning ${events.length} events`)
  return events
}
