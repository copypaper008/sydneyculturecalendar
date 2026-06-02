import { RawEvent } from '../types'

const BASE_URL = 'https://www.mca.com.au'
const API_URL = `${BASE_URL}/api/query-whats-on/?mode=block&show=everything&on=all-upcoming&for=everyone&limit=50&freeze=&filters=off&members_only=false`
const FETCH_TIMEOUT_MS = 12_000

interface MCAEvent {
  image: { src: string; alt: string } | null
  label: string
  status: string
  title: string
  url: string
  when: string
}

interface MCAResponse {
  events: MCAEvent[]
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.mca.com.au/events-programs/',
  'Origin': 'https://www.mca.com.au',
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS }).finally(() => clearTimeout(timer))
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
  // Handle "6–11pm" style where only end has am/pm marker
  const m = raw.match(/(\d{1,2})(?:[:.:](\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const mins = m[2] ?? '00'
  const period = m[3].toLowerCase()
  if (period === 'pm' && hours !== 12) hours += 12
  if (period === 'am' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${mins}`
}

/**
 * Parse MCA's `when` field, e.g.:
 *   "22 May – 13 June 2026, 6–11pm"
 *   "Thursday 28 May 2026, 6.30–7.30pm"
 *   "Every Thursday, 5–9pm (excluding public holidays)"  → skip (no fixed date)
 *   "Various dates and times"                            → skip
 */
function parseWhen(when: string): { start_date: string | null; end_date: string | null; start_time: string | null; end_time: string | null } {
  // Strip trailing time part after comma to isolate date portion
  const [datePart, timePart] = when.split(',').map(s => s.trim())

  // Recurring / no fixed date
  if (/every|various|ongoing/i.test(datePart)) {
    return { start_date: null, end_date: null, start_time: null, end_time: null }
  }

  let start_date: string | null = null
  let end_date: string | null = null

  // "22 May – 13 June 2026" or "22 May – 13 June 2026"
  const rangeRe = /(\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)\s*[–\-—]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/
  const rangeMatch = datePart.match(rangeRe)
  if (rangeMatch) {
    const endParsed = parseDate(rangeMatch[2])
    const year = (rangeMatch[2].match(/\d{4}/) ?? [])[0] ?? ''
    const startRaw = /\d{4}/.test(rangeMatch[1]) ? rangeMatch[1] : `${rangeMatch[1]} ${year}`
    start_date = parseDate(startRaw)
    end_date = endParsed !== start_date ? endParsed : null
  } else {
    start_date = parseDate(datePart)
  }

  // Times from timePart, e.g. "6–11pm" or "6.30–7.30pm"
  let start_time: string | null = null
  let end_time: string | null = null
  if (timePart) {
    // "6–11pm" — infer am/pm for start from end
    const compactRange = timePart.match(/(\d{1,2}(?:[.:]\d{2})?)\s*[–\-—]\s*(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))/i)
    if (compactRange) {
      const period = (compactRange[2].match(/am|pm/i) ?? [])[0] ?? 'pm'
      end_time = parseTime(compactRange[2])
      start_time = parseTime(`${compactRange[1]}${period}`)
    } else {
      // "6.30–7.30pm" already has period on end
      const fullRange = timePart.match(/(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\s*[–\-—]\s*(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))/i)
      if (fullRange) {
        start_time = parseTime(fullRange[1])
        end_time = parseTime(fullRange[2])
      } else {
        start_time = parseTime(timePart)
      }
    }
  }

  return { start_date, end_date, start_time, end_time }
}

function labelToEventType(label: string): string {
  switch (label.toLowerCase()) {
    case 'tours': return 'heritage'
    case 'talks': case 'talk': return 'talk'
    case 'live': case 'performance': return 'performance'
    case 'festival': return 'festival'
    case 'exhibition': return 'exhibition'
    default: return 'other'
  }
}

function isFree(status: string): boolean {
  const s = status.toLowerCase()
  if (s.includes('ticketed')) return false
  if (s.includes('no booking')) return true
  if (s.includes('general admission')) return false // GA ticket required
  if (s.includes('included with')) return false
  return true
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

async function scrapeEventDescription(url: string): Promise<string | undefined> {
  try {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
    const res = await fetchWithTimeout(fullUrl)
    if (!res.ok) return undefined
    const html = await res.text()
    const m = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/)
    return m ? decodeEntities(m[1]).trim() : undefined
  } catch {
    return undefined
  }
}

export async function fetchMCAEvents(): Promise<RawEvent[]> {
  let data: MCAResponse
  try {
    const res = await fetchWithTimeout(API_URL)
    if (!res.ok) {
      console.error(`[mca] API returned ${res.status}`)
      return []
    }
    data = await res.json() as MCAResponse
  } catch (err) {
    console.error('[mca] Failed to fetch API:', err)
    return []
  }

  console.log(`[mca] API returned ${data.events.length} events`)
  const events: RawEvent[] = []

  for (const e of data.events) {
    const { start_date, end_date, start_time, end_time } = parseWhen(e.when)

    if (!start_date) {
      console.log(`[mca] Skipping "${e.title}": no fixed date (when: "${e.when}")`)
      continue
    }

    const slug = e.url.split('/').filter(Boolean).pop() ?? e.title.toLowerCase().replace(/\s+/g, '-')
    const image_url = e.image?.src ? `${BASE_URL}${e.image.src}` : undefined
    const description = await scrapeEventDescription(e.url)

    events.push({
      title: e.title,
      institution: 'Museum of Contemporary Art',
      event_type: labelToEventType(e.label),
      start_date,
      end_date: end_date ?? undefined,
      start_time: start_time ?? undefined,
      end_time: end_time ?? undefined,
      venue: 'MCA Australia',
      suburb: 'The Rocks',
      description,
      image_url,
      event_url: e.url,
      is_free: isFree(e.status),
      tags: ['mca', isFree(e.status) ? 'free' : 'ticketed'],
      source: 'mca',
      source_id: slug,
    })
  }

  console.log(`[mca] Returning ${events.length} events`)
  return events
}
