import { RawEvent } from '../types'

const BASE_URL = 'https://www.mca.com.au'
const LISTING_URL = `${BASE_URL}/events-programs/`
const MAX_EVENTS = 30
const FETCH_TIMEOUT_MS = 12_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://www.mca.com.au/',
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

/** Extract full event URLs from the MCA listing page */
function extractEventUrls(html: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  // Links to exhibitions or events-programs detail pages
  const linkRe = /href="(https?:\/\/www\.mca\.com\.au\/(?:exhibitions|events-programs)\/[^"]+)"/gi
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html)) !== null) {
    const url = match[1].split('?')[0].replace(/\/$/, '')
    // Skip the listing page itself and pure category pages
    if (url === LISTING_URL.replace(/\/$/, '')) continue
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

function classifyEventType(html: string, title: string): string {
  const text = (html + ' ' + title).toLowerCase()
  if (text.includes('exhibition') || text.includes('on display') || text.includes('display')) return 'exhibition'
  if (text.includes('festival')) return 'festival'
  if (text.includes('talk') || text.includes('conversation') || text.includes('lecture') || text.includes('symposium')) return 'talk'
  if (text.includes('performance') || text.includes('live') || text.includes('concert') || text.includes('disco')) return 'performance'
  if (text.includes('tour') || text.includes('walk')) return 'heritage'
  if (text.includes('workshop') || text.includes('class') || text.includes('session')) return 'other'
  return 'other'
}

interface EventDetails {
  title: string
  description: string
  image_url: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  event_type: string
  is_free: boolean
  is_online: boolean
}

async function scrapeEventPage(url: string): Promise<EventDetails | null> {
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const html = await res.text()

    // Title
    let title = ''
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
    if (ogTitle) {
      title = decodeEntities(ogTitle[1])
    } else {
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
      if (h1) title = decodeEntities(stripTags(h1[1]))
    }
    if (!title) return null

    // Description
    let description = ''
    const ogDesc = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/)
    if (ogDesc) description = decodeEntities(ogDesc[1])

    // Image — og:image first, then first /files/images/ src
    let image_url: string | null = null
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    if (ogImage) {
      const raw = ogImage[1]
      image_url = raw.startsWith('http') ? raw : `${BASE_URL}${raw}`
    } else {
      const imgSrc = html.match(/src="(\/files\/images\/[^"]+)"/)
      if (imgSrc) image_url = `${BASE_URL}${imgSrc[1]}`
    }

    // Dates — MCA uses "DD Month YYYY" and "DD Month – DD Month YYYY" patterns
    // Also check JSON-LD schema
    let start_date: string | null = null
    let end_date: string | null = null

    // Try JSON-LD first
    const jsonLd = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd[1])
        const startRaw = data.startDate ?? data.datePublished ?? null
        const endRaw = data.endDate ?? null
        if (startRaw) start_date = startRaw.slice(0, 10)
        if (endRaw) end_date = endRaw.slice(0, 10)
      } catch { /* ignore */ }
    }

    // Fallback: date_range div or plain text patterns
    if (!start_date) {
      // "21 May – 19 October 2026" or "21 May – 19 October 2026"
      const dateRangeRe = /(\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)\s*[–\-—]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/
      const rangeMatch = html.match(dateRangeRe)
      if (rangeMatch) {
        const endParsed = parseDate(rangeMatch[2])
        const yearMatch = rangeMatch[2].match(/\d{4}/)
        const year = yearMatch ? yearMatch[0] : ''
        const startRaw = rangeMatch[1].match(/\d{4}/) ? rangeMatch[1] : `${rangeMatch[1]} ${year}`
        start_date = parseDate(startRaw)
        end_date = endParsed !== start_date ? endParsed : null
      } else {
        const singleDateRe = /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/g
        const dates: string[] = []
        let dm: RegExpExecArray | null
        while ((dm = singleDateRe.exec(html)) !== null) {
          const parsed = parseDate(dm[1])
          if (parsed && !dates.includes(parsed)) dates.push(parsed)
          if (dates.length >= 2) break
        }
        if (dates.length >= 1) start_date = dates[0]
        if (dates.length >= 2) end_date = dates[1]
      }
    }

    // Times
    let start_time: string | null = null
    let end_time: string | null = null
    const timeRangeRe = /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–\-—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i
    const timeRangeMatch = html.match(timeRangeRe)
    if (timeRangeMatch) {
      start_time = parseTime(timeRangeMatch[1])
      end_time = parseTime(timeRangeMatch[2])
    } else {
      const singleTimeRe = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i
      const stm = html.match(singleTimeRe)
      if (stm) start_time = parseTime(stm[1])
    }

    const is_free = /\bfree\b/i.test(html) && !/\bfree\s+with\s+(?:paid|ticket)/i.test(html)
    const is_online = /online[- ]only|virtual event|webinar/i.test(html)
    const event_type = classifyEventType(html, title)

    return { title, description, image_url, start_date, end_date, start_time, end_time, event_type, is_free, is_online }
  } catch (err) {
    console.error(`[mca] Error scraping ${url}:`, err)
    return null
  }
}

export async function fetchMCAEvents(): Promise<RawEvent[]> {
  let listingHtml: string
  try {
    const res = await fetchWithTimeout(LISTING_URL)
    if (!res.ok) {
      console.error(`[mca] Listing page returned ${res.status}`)
      return []
    }
    listingHtml = await res.text()
  } catch (err) {
    console.error('[mca] Failed to fetch listing page:', err)
    return []
  }

  const urls = extractEventUrls(listingHtml).slice(0, MAX_EVENTS)
  console.log(`[mca] Found ${urls.length} event URLs`)

  const events: RawEvent[] = []

  for (const url of urls) {
    const slug = url.split('/').filter(Boolean).pop() ?? url
    const details = await scrapeEventPage(url)
    if (!details) {
      console.log(`[mca] Skipping ${slug}: no details`)
      continue
    }
    if (details.is_online) {
      console.log(`[mca] Skipping ${slug}: online event`)
      continue
    }
    if (!details.start_date) {
      console.log(`[mca] Skipping ${slug}: no date`)
      continue
    }

    events.push({
      title: details.title,
      institution: 'Museum of Contemporary Art',
      event_type: details.event_type,
      start_date: details.start_date,
      end_date: details.end_date ?? undefined,
      start_time: details.start_time ?? undefined,
      end_time: details.end_time ?? undefined,
      venue: 'MCA Australia',
      suburb: 'The Rocks',
      description: details.description || undefined,
      image_url: details.image_url ?? undefined,
      event_url: url,
      is_free: details.is_free,
      tags: ['mca', details.is_free ? 'free' : 'ticketed'],
      source: 'mca',
      source_id: slug,
    })
  }

  console.log(`[mca] Returning ${events.length} events`)
  return events
}
