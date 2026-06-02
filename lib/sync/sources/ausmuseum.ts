import { RawEvent } from '../types'

const BASE_URL = 'https://australian.museum'
const WHATS_ON_URL = `${BASE_URL}/visit/whats-on/`
const FETCH_TIMEOUT_MS = 12_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://australian.museum/',
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { signal: controller.signal, ...init }).finally(() => clearTimeout(timer))
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

function parseDate(raw: string): string | null {
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

interface AusMuseumEvent {
  title: string
  url: string
  image_url: string | null
  start_date: string | null
  end_date: string | null
  event_type: string
  is_free: boolean
}

function parseListingPage(html: string): AusMuseumEvent[] {
  const events: AusMuseumEvent[] = []
  const seen = new Set<string>()

  // Each event card has a link to /visit/whats-on/[slug]
  // Grab the link and then the surrounding context (up to next link)
  const linkRe = /href="(https?:\/\/australian\.museum\/visit\/whats-on\/[a-z0-9][^"?#]+)"/gi
  let m: RegExpExecArray | null
  const urls: string[] = []
  while ((m = linkRe.exec(html)) !== null) {
    const url = m[1].split('?')[0].replace(/\/$/, '')
    if (!seen.has(url)) { seen.add(url); urls.push(url) }
  }

  console.log(`[ausmuseum] Found ${urls.length} event links in HTML`)

  for (const url of urls) {
    // Find the context around this URL in the HTML
    const idx = html.indexOf(`href="${url}"`)
    if (idx === -1) continue
    // Take a window of HTML around the link for parsing
    const start = Math.max(0, idx - 600)
    const end = Math.min(html.length, idx + 1200)
    const context = html.slice(start, end)

    // Title from h3/h4
    const titleM = context.match(/<h[2-5][^>]*class="[^"]*(?:card|title)[^"]*"[^>]*>([\s\S]*?)<\/h[2-5]>/)
      ?? context.match(/<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/)
    if (!titleM) continue
    const title = decodeEntities(stripTags(titleM[1])).trim()
    if (!title || title.length < 3) continue

    // Image from background-image style
    let image_url: string | null = null
    const bgM = context.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/)
    if (bgM) image_url = bgM[1].startsWith('http') ? bgM[1] : `${BASE_URL}${bgM[1]}`
    if (!image_url) {
      const imgM = context.match(/<img[^>]+src="([^"]+)"/)
      if (imgM) image_url = imgM[1].startsWith('http') ? imgM[1] : `${BASE_URL}${imgM[1]}`
    }

    // Dates
    let start_date: string | null = null
    let end_date: string | null = null
    const dateRangeM = context.match(/(\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)\s*[–\-—]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/)
    if (dateRangeM) {
      const endParsed = parseDate(dateRangeM[2])
      const year = (dateRangeM[2].match(/\d{4}/) ?? [])[0] ?? ''
      const startRaw = /\d{4}/.test(dateRangeM[1]) ? dateRangeM[1] : `${dateRangeM[1]} ${year}`
      start_date = parseDate(startRaw)
      end_date = endParsed !== start_date ? endParsed : null
    } else {
      const singleM = context.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/)
      if (singleM) start_date = parseDate(singleM[1])
    }

    // Event type from content-tag
    const typeM = context.match(/class="[^"]*content-tag[^"]*"[^>]*>\s*([^<]{2,30})\s*</)
    const typeText = typeM ? typeM[1].toLowerCase().trim() : ''
    let event_type = 'other'
    if (typeText.includes('exhibition')) event_type = 'exhibition'
    else if (typeText.includes('talk') || typeText.includes('lecture')) event_type = 'talk'
    else if (typeText.includes('tour')) event_type = 'heritage'
    else if (typeText.includes('performance')) event_type = 'performance'
    else if (typeText.includes('festival')) event_type = 'festival'

    const is_free = /\bfree\b/i.test(context) && !/charges apply|buy ticket|ticketed/i.test(context)

    events.push({ title, url, image_url, start_date, end_date, event_type, is_free })
  }

  return events
}

export async function fetchAustralianMuseumEvents(): Promise<RawEvent[]> {
  let html: string
  try {
    const res = await fetchWithTimeout(WHATS_ON_URL, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      console.error(`[ausmuseum] Page returned ${res.status}`)
      return []
    }
    html = await res.text()
    console.log(`[ausmuseum] Fetched listing page (${html.length} chars)`)
  } catch (err) {
    console.error('[ausmuseum] Failed to fetch listing page:', err)
    return []
  }

  const parsed = parseListingPage(html)
  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []

  for (const e of parsed) {
    // Skip if no date and not "now open"
    if (!e.start_date && !e.end_date) {
      const nowOpen = /now open/i.test(html.slice(
        Math.max(0, html.indexOf(e.url) - 500),
        html.indexOf(e.url) + 500
      ))
      if (!nowOpen) { console.log(`[ausmuseum] Skipping "${e.title}": no date`); continue }
    }
    if (e.end_date && e.end_date < today) {
      console.log(`[ausmuseum] Skipping "${e.title}": past`)
      continue
    }

    const slug = e.url.split('/').filter(Boolean).pop() ?? e.title.toLowerCase().replace(/\s+/g, '-')
    events.push({
      title: e.title,
      institution: 'Australian Museum',
      event_type: e.event_type,
      start_date: e.start_date ?? today,
      end_date: e.end_date ?? undefined,
      venue: 'Australian Museum',
      suburb: 'Sydney CBD',
      image_url: e.image_url ?? undefined,
      event_url: e.url,
      is_free: e.is_free,
      tags: ['australian-museum', e.is_free ? 'free' : 'ticketed'],
      source: 'ausmuseum',
      source_id: slug,
    })
  }

  console.log(`[ausmuseum] Returning ${events.length} events`)
  return events
}
