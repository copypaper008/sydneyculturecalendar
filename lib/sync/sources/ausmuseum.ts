import { RawEvent } from '../types'

const BASE_URL = 'https://australian.museum'
const WHATS_ON_URL = `${BASE_URL}/visit/whats-on/`
const API_URL = `${BASE_URL}/whatson-api/events/`
const FETCH_TIMEOUT_MS = 12_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
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

/** Extract CSRF token from cookie header or HTML */
function extractCsrf(html: string, cookieHeader: string): string {
  // Django sets csrftoken cookie
  const cookieM = cookieHeader.match(/csrftoken=([^;,\s]+)/)
  if (cookieM) return cookieM[1]
  // Hidden input: <input ... name="csrfmiddlewaretoken" value="TOKEN" ...>
  const inputM = html.match(/name="csrfmiddlewaretoken"[^>]*value="([^"]+)"/)
    ?? html.match(/value="([^"]+)"[^>]*name="csrfmiddlewaretoken"/)
  if (inputM) return inputM[1]
  // Meta tag
  const metaM = html.match(/<meta[^>]+name="csrf-?token"[^>]+content="([^"]+)"/)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+name="csrf-?token"/)
  if (metaM) return metaM[1]
  // JS assignment: csrfToken = "..."
  const jsM = html.match(/csrf[_-]?[Tt]oken['":\s=]+['"]([a-zA-Z0-9]{20,})['"]/)
  if (jsM) return jsM[1]
  return ''
}

interface AusMuseumEvent {
  title: string
  url: string
  image_url: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  event_type: string
  is_free: boolean
}

/** Parse events from the API response HTML or JSON */
function parseApiResponse(body: string): AusMuseumEvent[] {
  const events: AusMuseumEvent[] = []

  // Try JSON first
  try {
    const json = JSON.parse(body)
    const items = json.events ?? json.results ?? json.data ?? (Array.isArray(json) ? json : null)
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const title = item.title ?? item.name ?? ''
        if (!title) continue
        const url = item.url ?? item.link ?? ''
        const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        const image_url = item.image ?? item.image_url ?? item.thumbnail ?? null
        const start_date = item.start_date ? parseDate(item.start_date) : null
        const end_date = item.end_date ? parseDate(item.end_date) : null
        const is_free = /free/i.test(item.price ?? item.cost ?? item.ticket_type ?? '') ||
          item.is_free === true || item.free === true
        events.push({
          title: decodeEntities(title),
          url: fullUrl,
          image_url,
          start_date,
          end_date,
          start_time: null,
          end_time: null,
          event_type: 'other',
          is_free,
        })
      }
      return events
    }
  } catch { /* not JSON, parse as HTML */ }

  // Parse as HTML — look for event card patterns
  // Australian Museum uses blockbuster-card and event-calendar__item patterns
  const cardRe = /<(?:div|article)[^>]*class="[^"]*(?:blockbuster-card|event-card|event-calendar__item)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/gi
  let m: RegExpExecArray | null

  // Simpler: extract all /visit/whats-on/[slug] hrefs with their surrounding context
  const linkRe = /href="(https?:\/\/australian\.museum\/visit\/whats-on\/[^"]+)"[^>]*>([\s\S]{0,800}?)(?=href="|$)/gi
  while ((m = linkRe.exec(body)) !== null) {
    const url = m[1].split('?')[0]
    const context = m[2]

    // Title from h3/h4
    const titleM = context.match(/<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/)
    if (!titleM) continue
    const title = decodeEntities(stripTags(titleM[1])).trim()
    if (!title || title.length < 3) continue

    // Image from background-image style or src
    let image_url: string | null = null
    const bgM = context.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/)
    if (bgM) image_url = bgM[1].startsWith('http') ? bgM[1] : `${BASE_URL}${bgM[1]}`
    if (!image_url) {
      const imgM = context.match(/<img[^>]+src="([^"]+)"/)
      if (imgM) image_url = imgM[1].startsWith('http') ? imgM[1] : `${BASE_URL}${imgM[1]}`
    }

    // Dates
    const dateRangeM = context.match(/(\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)\s*[–\-—]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/)
    let start_date: string | null = null
    let end_date: string | null = null
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

    // Event type
    const typeM = context.match(/class="[^"]*content-tag[^"]*"[^>]*>([^<]+)</)
    const typeText = typeM ? typeM[1].toLowerCase() : ''
    let event_type = 'other'
    if (typeText.includes('exhibition')) event_type = 'exhibition'
    else if (typeText.includes('talk') || typeText.includes('lecture')) event_type = 'talk'
    else if (typeText.includes('tour')) event_type = 'heritage'
    else if (typeText.includes('performance')) event_type = 'performance'
    else if (typeText.includes('festival')) event_type = 'festival'

    const is_free = /\bfree\b/i.test(context) && !/charges apply|buy ticket/i.test(context)

    const slug = url.split('/').filter(Boolean).pop() ?? ''
    if (events.some(e => e.url === url)) continue

    events.push({ title, url, image_url, start_date, end_date, start_time: null, end_time: null, event_type, is_free })
  }

  return events
}

export async function fetchAustralianMuseumEvents(): Promise<RawEvent[]> {
  // Step 1: GET the page to obtain CSRF token
  let pageHtml = ''
  let csrfToken = ''
  let sessionCookies = ''

  try {
    const pageRes = await fetchWithTimeout(WHATS_ON_URL, { headers: BROWSER_HEADERS })
    if (!pageRes.ok) {
      console.error(`[ausmuseum] Page returned ${pageRes.status}`)
      return []
    }
    pageHtml = await pageRes.text()
    const setCookie = pageRes.headers.get('set-cookie') ?? ''
    sessionCookies = setCookie
    csrfToken = extractCsrf(pageHtml, setCookie)
  } catch (err) {
    console.error('[ausmuseum] Failed to fetch page:', err)
    return []
  }

  if (!csrfToken) {
    console.error('[ausmuseum] Could not extract CSRF token')
    return []
  }

  // Step 2: POST to events API
  let apiBody = ''
  try {
    const cookieHeader = sessionCookies
      .split(/,(?=[^;]+?=)/)
      .map(c => c.trim().split(';')[0])
      .join('; ')

    const apiRes = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': WHATS_ON_URL,
        'X-CSRFToken': csrfToken,
        'Cookie': cookieHeader,
      },
      body: `csrfmiddlewaretoken=${encodeURIComponent(csrfToken)}&date_range=anytime&event_type=&audience=`,
    })
    if (!apiRes.ok) {
      console.error(`[ausmuseum] API returned ${apiRes.status}`)
      return []
    }
    apiBody = await apiRes.text()
  } catch (err) {
    console.error('[ausmuseum] Failed to call events API:', err)
    return []
  }

  const parsed = parseApiResponse(apiBody)
  console.log(`[ausmuseum] Parsed ${parsed.length} events from API`)

  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []

  for (const e of parsed) {
    if (!e.start_date && !e.end_date) {
      // "Now open" / permanent exhibitions — use today as start
      const nowOpenM = pageHtml.match(new RegExp(e.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,300}Now open', 'i'))
      if (!nowOpenM) {
        console.log(`[ausmuseum] Skipping "${e.title}": no date`)
        continue
      }
    }
    if (e.end_date && e.end_date < today) {
      console.log(`[ausmuseum] Skipping "${e.title}": past event`)
      continue
    }

    const slug = e.url.split('/').filter(Boolean).pop() ?? e.title.toLowerCase().replace(/\s+/g, '-')
    events.push({
      title: e.title,
      institution: 'Australian Museum',
      event_type: e.event_type,
      start_date: e.start_date ?? today,
      end_date: e.end_date ?? undefined,
      start_time: e.start_time ?? undefined,
      end_time: e.end_time ?? undefined,
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
