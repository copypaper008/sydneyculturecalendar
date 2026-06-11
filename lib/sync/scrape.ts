/**
 * Shared scraping toolkit for source adapters and the descriptor-driven
 * generic adapter. Generalised from the patterns in the hand-written
 * adapters (see docs/PLATFORM_SPEC.md §8.2).
 */

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
}

export const GOOGLEBOT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

export function fetchWithTimeout(
  url: string,
  headers: Record<string, string> = BROWSER_HEADERS,
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { signal: controller.signal, headers }).finally(() => clearTimeout(timer))
}

export function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
}

export function absoluteUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

export function slugFromUrl(url: string): string {
  return url.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? ''
}

// ── Dates & times ─────────────────────────────────────────────────────────────

export const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

const MONTH_ALT =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?'

function monthNumber(name: string): string | null {
  const lower = name.toLowerCase()
  if (MONTHS[lower]) return MONTHS[lower]
  const full = Object.keys(MONTHS).find((m) => m.startsWith(lower.slice(0, 3)))
  return full ? MONTHS[full] : null
}

/** Parse "14 June 2026" / "14 Jun 2026" / "14 June" (with fallback year) → YYYY-MM-DD. */
export function parseHumanDate(raw: string, fallbackYear?: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  const m = raw.match(new RegExp(`(\\d{1,2})\\s+(${MONTH_ALT})(?:\\s+(\\d{4}))?`, 'i'))
  if (!m) return null
  const month = monthNumber(m[2])
  if (!month) return null
  const year = m[3] ?? fallbackYear
  if (!year) return null
  return `${year}-${month}-${m[1].padStart(2, '0')}`
}

/**
 * Find a "14 June – 20 July 2026" / "14 – 20 June 2026" style range in text.
 * Infers the start year from the end and rolls it back one year for
 * cross-year ranges ("14 Nov – 2 Jan 2026").
 */
export function parseDateRangeText(text: string): { start: string | null; end: string | null } {
  const rangeRe = new RegExp(
    `(\\d{1,2}(?:\\s+(?:${MONTH_ALT}))?(?:\\s+\\d{4})?)\\s*[–\\-—]\\s*(\\d{1,2}\\s+(?:${MONTH_ALT})\\s+\\d{4})`,
    'i',
  )
  const m = text.match(rangeRe)
  if (!m) {
    const single = parseHumanDate(text)
    return { start: single, end: null }
  }
  const end = parseHumanDate(m[2])
  const year = (m[2].match(/\d{4}/) ?? [])[0]
  let startRaw = m[1]
  // "10 – 14 July 2027": bare start day inherits the end's month
  if (/^\d{1,2}$/.test(startRaw.trim())) {
    const endMonth = m[2].match(new RegExp(`(${MONTH_ALT})`, 'i'))
    if (endMonth) startRaw = `${startRaw.trim()} ${endMonth[1]}`
  }
  let start = parseHumanDate(startRaw, year)
  if (start && end && start > end) {
    const [sy, sm, sd] = start.split('-')
    start = `${parseInt(sy) - 1}-${sm}-${sd}`
  }
  return { start, end: end !== start ? end : null }
}

/** "closes 20 July 2026" / "until 20 July 2026" / "through 20 July 2026" → ISO. */
export function parseClosingDateText(text: string): string | null {
  const re = new RegExp(
    `(?:closes?|closing|until|open\\s+until|now\\s+until|ends?\\s+on|through|concludes?)\\s+(\\d{1,2}\\s+(?:${MONTH_ALT})\\s+\\d{4})`,
    'i',
  )
  const m = text.match(re)
  return m ? parseHumanDate(m[1]) : null
}

/** "10:00am" / "2.30 PM" → HH:MM (24h). */
export function parseTime(raw: string): string | null {
  const m = raw.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const mins = m[2] ?? '00'
  const period = m[3].toLowerCase()
  if (period === 'pm' && hours !== 12) hours += 12
  if (period === 'am' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${mins}`
}

/** "10am – 5pm" / "6–11pm" (start period inferred from end) → start/end times. */
export function parseTimeRangeText(text: string): { start_time: string | null; end_time: string | null } {
  const full = text.match(/(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))\s*[–\-—]\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))/i)
  if (full) return { start_time: parseTime(full[1]), end_time: parseTime(full[2]) }
  const compact = text.match(/(\d{1,2}(?:[:.]\d{2})?)\s*[–\-—]\s*(\d{1,2}(?:[:.]\d{2})?\s*(am|pm))/i)
  if (compact) {
    return { start_time: parseTime(`${compact[1]}${compact[3]}`), end_time: parseTime(compact[2]) }
  }
  const single = text.match(/\b(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))\b/i)
  return { start_time: single ? parseTime(single[1]) : null, end_time: null }
}

// ── HTML metadata ─────────────────────────────────────────────────────────────

/** <meta property/name="..." content="..."> — both attribute orders, both quote styles. */
export function metaContent(html: string, key: string): string | null {
  const k = key.replace(/[:]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]+)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="${k}"`, 'i'),
    new RegExp(`<meta[^>]+(?:property|name)='${k}'[^>]+content='([^']+)'`, 'i'),
    new RegExp(`<meta[^>]+content='([^']+)'[^>]+(?:property|name)='${k}'`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1]).trim()
  }
  return null
}

/** First non-boilerplate description: og:description → description → twitter → JSON-LD. */
export function extractDescription(html: string): string {
  for (const key of ['og:description', 'description', 'twitter:description']) {
    const v = metaContent(html, key)
    if (v) return v
  }
  for (const block of extractJsonLd(html)) {
    const d = findInJsonLd(block, ['description'])
    if (d) return decodeEntities(d).trim()
  }
  return ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJsonLd(html: string): any[] {
  const blocks = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
    try {
      const parsed = JSON.parse(inner)
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]))
    } catch { /* ignore malformed blocks */ }
  }
  return out
}

/** Depth-limited search for the first string value under any of the given keys. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findInJsonLd(obj: any, keys: string[], depth = 0): string | null {
  if (!obj || typeof obj !== 'object' || depth > 6) return null
  for (const key of keys) {
    if (key in obj && obj[key] != null && typeof obj[key] !== 'object') return String(obj[key])
  }
  for (const v of Object.values(obj)) {
    const r = findInJsonLd(v, keys, depth + 1)
    if (r) return r
  }
  return null
}

export interface JsonLdEventData {
  start_date: string | null
  end_date: string | null
  types: string
}

/** Dates + @type hints from JSON-LD, preferring Event/Exhibition-typed nodes. */
export function jsonLdEventData(html: string): JsonLdEventData {
  const items = extractJsonLd(html)
  let start: string | null = null
  let end: string | null = null
  let types = ''
  const passes = [
    (t: string) => t.includes('event') || t.includes('exhibition'),
    () => true,
  ]
  for (const accept of passes) {
    for (const item of items) {
      const type = String(item?.['@type'] ?? '').toLowerCase()
      types += ' ' + type
      if (!accept(type)) continue
      if (item.startDate && !start) start = String(item.startDate).slice(0, 10)
      if (item.endDate && !end) end = String(item.endDate).slice(0, 10)
    }
    if (start) break
  }
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) start = parseHumanDate(start)
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) end = parseHumanDate(end)
  return { start_date: start, end_date: end, types }
}

// ── Classification heuristics ─────────────────────────────────────────────────

/** Keyword classifier merged from the hand-written adapters. */
export function classifyEventType(text: string, fallback = 'other'): string {
  const t = text.toLowerCase()
  if (/\bfestival\b/.test(t)) return 'festival'
  if (/exhibition|on display|exhibitionevent/.test(t)) return 'exhibition'
  if (/\btalk|lecture|panel|forum|seminar|conversation|discussion|author|book launch|literaryevent|educationevent|workshop|class\b/.test(t)) return 'talk'
  if (/\btour\b|heritage|guided walk/.test(t)) return 'heritage'
  if (/performance|concert|\blive music\b|screening|cinema|recital|performingevent/.test(t)) return 'performance'
  if (/open day|open weekend|open house/.test(t)) return 'open_day'
  return fallback
}

/**
 * Free detection with counter-signals: a page mentioning "free" is not free
 * if it lists priced tickets ("Adult: $25") or says "charges apply".
 */
export function detectIsFree(html: string): boolean {
  const text = stripTags(html).toLowerCase()
  const priced = /charges apply|entry fees?|adult[:\s]+\$|family[:\s]+\$|concession[:\s]+\$|buy tickets?|ticketed|paid (?:activit|ticket|admission)/i.test(text)
  return !priced && /\bfree\b/.test(text)
}

/** Permanent/ongoing exhibition markers. */
export function detectOngoing(html: string, title = ''): boolean {
  return (
    /\bpermanent\s+(?:exhibit(?:ion)?|collection|display|gallery|attraction|installation)\b/i.test(html) ||
    /\bon\s+permanent\s+display\b/i.test(html) ||
    /\bpermanent\b/i.test(title)
  )
}
