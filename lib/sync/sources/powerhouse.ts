import { RawEvent } from '../types'

const BASE_URL = 'https://powerhouse.com.au'
const EVENTS_URL = `${BASE_URL}/events`
const FETCH_TIMEOUT_MS = 12_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://powerhouse.com.au/',
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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

function parseDate(raw: string): string | null {
  // Try YYYY-MM-DD first
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const month = MONTHS[m[2].toLowerCase()]
  if (!month) return null
  return `${m[3]}-${month}-${day}`
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

/** Extract unique /program/ slugs from the events listing page */
function extractProgramSlugs(html: string): string[] {
  const slugs: string[] = []
  const seen = new Set<string>()
  const re = /href="(\/program\/[a-z0-9][a-z0-9\-]+)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const path = m[1]
    if (!seen.has(path)) {
      seen.add(path)
      slugs.push(path)
    }
  }
  return slugs
}

function classifyEventType(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('exhibition') || t.includes('display') || t.includes('collection')) return 'exhibition'
  if (t.includes('festival')) return 'festival'
  if (t.includes('talk') || t.includes('lecture') || t.includes('conversation') || t.includes('forum')) return 'talk'
  if (t.includes('tour') || t.includes('walk')) return 'heritage'
  if (t.includes('performance') || t.includes('concert') || t.includes('live')) return 'performance'
  if (t.includes('workshop') || t.includes('class') || t.includes('session')) return 'other'
  return 'other'
}

interface ProgramDetails {
  title: string
  description: string
  image_url: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  venue: string | null
  is_free: boolean
  is_recurring: boolean
  event_type: string
}

async function scrapeProgramPage(path: string): Promise<ProgramDetails | null> {
  const url = `${BASE_URL}${path}`
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const html = await res.text()

    // Title
    let title = ''
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
    if (ogTitle) {
      title = decodeEntities(ogTitle[1]).replace(/\s*[|\-–]\s*Powerhouse.*$/i, '').trim()
    } else {
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
      if (h1) title = decodeEntities(stripTags(h1[1])).trim()
    }
    if (!title) return null

    // Description
    let description = ''
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)
      ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/)
      ?? html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)
      ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/)
    if (ogDesc) description = decodeEntities(ogDesc[1])

    // Image
    let image_url: string | null = null
    const ogImg = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    if (ogImg) image_url = ogImg[1].startsWith('http') ? ogImg[1] : `${BASE_URL}${ogImg[1]}`

    // Dates — try JSON-LD first
    let start_date: string | null = null
    let end_date: string | null = null
    const jsonLdM = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonLdM) {
      for (const block of jsonLdM) {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
        try {
          const data = JSON.parse(inner)
          const items = Array.isArray(data) ? data : [data]
          for (const item of items) {
            if (item.startDate) { start_date = item.startDate.slice(0, 10); break }
          }
          for (const item of items) {
            if (item.endDate) { end_date = item.endDate.slice(0, 10); break }
          }
        } catch { /* ignore */ }
        if (start_date) break
      }
    }

    // Fallback: look for date patterns in text
    const isRecurring = /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)|monthly|weekly|daily|ongoing/i.test(html)

    if (!start_date && !isRecurring) {
      // "SAT 20 JUN" style (no year — infer current/next year)
      const shortDateM = html.match(/(?:mon|tue|wed|thu|fri|sat|sun)\s+(\d{1,2})\s+([A-Za-z]{3,})/i)
      if (shortDateM) {
        const day = shortDateM[1].padStart(2, '0')
        const month = MONTHS[shortDateM[2].toLowerCase().slice(0, 3) + shortDateM[2].toLowerCase().slice(3)]
          ?? MONTHS[Object.keys(MONTHS).find(k => k.startsWith(shortDateM[2].toLowerCase().slice(0, 3))) ?? '']
        if (month) {
          const now = new Date()
          let year = now.getFullYear()
          const candidate = `${year}-${month}-${day}`
          if (candidate < now.toISOString().slice(0, 10)) year++
          start_date = `${year}-${month}-${day}`
        }
      }
      // Full date fallback
      if (!start_date) {
        const fullDateM = html.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/)
        if (fullDateM) start_date = parseDate(fullDateM[1])
      }
    }

    // Times
    let start_time: string | null = null
    let end_time: string | null = null
    const timeRangeM = html.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–\-—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
    if (timeRangeM) {
      start_time = parseTime(timeRangeM[1])
      end_time = parseTime(timeRangeM[2])
    }

    // Venue — look for location metadata or known Powerhouse venues
    let venue: string | null = null
    const venueKeywords = [
      'Castle Hill', 'Sydney Observatory', 'Powerhouse Ultimo',
      'Powerhouse Parramatta', 'Powerhouse Castle Hill',
    ]
    for (const v of venueKeywords) {
      if (html.includes(v)) { venue = v; break }
    }
    if (!venue) venue = 'Powerhouse Museum'

    const suburb = venue.includes('Castle Hill') ? 'Castle Hill'
      : venue.includes('Parramatta') ? 'Parramatta'
      : venue.includes('Observatory') ? 'Millers Point'
      : 'Ultimo'

    // Free detection
    const is_free = /\bfree\b/i.test(html) && !/charges apply|ticketed|purchase/i.test(html)

    const event_type = classifyEventType(title + ' ' + description)

    return {
      title, description, image_url,
      start_date, end_date, start_time, end_time,
      venue: `${venue}, ${suburb}`,
      is_free, is_recurring: isRecurring, event_type,
    }
  } catch (err) {
    console.error(`[powerhouse] Error scraping ${path}:`, err)
    return null
  }
}

export async function fetchPowerhouseEvents(): Promise<RawEvent[]> {
  let listingHtml: string
  try {
    const res = await fetchWithTimeout(EVENTS_URL)
    if (!res.ok) {
      console.error(`[powerhouse] Listing page returned ${res.status}`)
      return []
    }
    listingHtml = await res.text()
  } catch (err) {
    console.error('[powerhouse] Failed to fetch listing page:', err)
    return []
  }

  const paths = extractProgramSlugs(listingHtml)
  console.log(`[powerhouse] Found ${paths.length} program paths`)

  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []

  for (const path of paths) {
    const slug = path.split('/').filter(Boolean).pop()!
    const details = await scrapeProgramPage(path)

    if (!details) {
      console.log(`[powerhouse] Skipping ${slug}: no details`)
      continue
    }
    if (details.is_recurring) {
      console.log(`[powerhouse] Skipping ${slug}: recurring/no fixed date`)
      continue
    }
    if (!details.start_date) {
      console.log(`[powerhouse] Skipping ${slug}: no date found`)
      continue
    }
    if (details.start_date < today && (!details.end_date || details.end_date < today)) {
      console.log(`[powerhouse] Skipping ${slug}: past event`)
      continue
    }

    events.push({
      title: details.title,
      institution: 'Powerhouse Museum',
      event_type: details.event_type,
      start_date: details.start_date,
      end_date: details.end_date ?? undefined,
      start_time: details.start_time ?? undefined,
      end_time: details.end_time ?? undefined,
      venue: details.venue ?? 'Powerhouse Museum',
      suburb: details.venue?.includes('Castle Hill') ? 'Castle Hill'
        : details.venue?.includes('Parramatta') ? 'Parramatta'
        : details.venue?.includes('Observatory') ? 'Millers Point'
        : 'Ultimo',
      description: details.description || undefined,
      image_url: details.image_url ?? undefined,
      event_url: `${BASE_URL}${path}`,
      is_free: details.is_free,
      tags: ['powerhouse', details.is_free ? 'free' : 'ticketed'],
      source: 'powerhouse',
      source_id: slug,
    })
  }

  console.log(`[powerhouse] Returning ${events.length} events`)
  return events
}
