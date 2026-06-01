import { RawEvent } from '../types'

const BASE_URL = 'https://www.sl.nsw.gov.au'
const WHATS_ON_URL = `${BASE_URL}/whats-on`
const MAX_EVENTS = 20
const FETCH_TIMEOUT_MS = 10_000

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

/** Extract event slugs from the whats-on listing page */
function extractSlugs(html: string): string[] {
  const slugs: string[] = []
  // Match hrefs like /events/some-slug or /whats-on/some-slug
  const linkRe = /href="\/(?:events|whats-on)\/([a-z0-9][a-z0-9\-]+)"/gi
  let match: RegExpExecArray | null
  const seen = new Set<string>()
  while ((match = linkRe.exec(html)) !== null) {
    const slug = match[1]
    // Skip pagination/filter slugs
    if (slug.startsWith('page') || slug.startsWith('filter')) continue
    if (!seen.has(slug)) {
      seen.add(slug)
      slugs.push(slug)
    }
  }
  return slugs
}

/** Strip HTML tags from a string */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Decode common HTML entities */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Parse a date string like "Saturday 14 June 2025" or "14 June 2025" into YYYY-MM-DD */
function parseDate(raw: string): string | null {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  }
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const month = months[m[2].toLowerCase()]
  if (!month) return null
  return `${m[3]}-${month}-${day}`
}

/** Parse a time string like "10:00am" or "2:30 PM" into HH:MM (24h) */
function parseTime(raw: string): string | null {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const mins = m[2] ? m[2] : '00'
  const period = m[3].toLowerCase()
  if (period === 'pm' && hours !== 12) hours += 12
  if (period === 'am' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${mins}`
}

interface EventDetails {
  title: string
  description: string
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  venue: string | null
  is_online: boolean
}

/** Scrape a single event page for details */
async function scrapeEventPage(slug: string): Promise<EventDetails | null> {
  const url = `${BASE_URL}/events/${slug}`
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const html = await res.text()

    // Title: look for og:title or h1
    let title = ''
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)
    if (ogTitle) {
      title = decodeEntities(ogTitle[1])
    } else {
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
      if (h1) title = decodeEntities(stripTags(h1[1]))
    }
    if (!title) return null

    // Description: og:description or first <p> in main content
    let description = ''
    const ogDesc = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/)
    if (ogDesc) {
      description = decodeEntities(ogDesc[1])
    }

    // Date ranges — look for patterns like "14 June – 20 July 2025" or "14–20 June 2025"
    // Also "Saturday 14 June 2025"
    let start_date: string | null = null
    let end_date: string | null = null

    // Pattern: "DD Month – DD Month YYYY" or "DD – DD Month YYYY"
    const dateRangeRe = /(\d{1,2}(?:\s+[A-Za-z]+)?)\s*[–\-—]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/
    const singleDateRe = /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/g

    const rangeMatch = html.match(dateRangeRe)
    if (rangeMatch) {
      // end date has year; need to infer year for start if missing
      const endParsed = parseDate(rangeMatch[2])
      // Try to get start year from end
      const yearMatch = rangeMatch[2].match(/\d{4}/)
      const year = yearMatch ? yearMatch[0] : ''
      const startRaw = rangeMatch[1].includes(year) ? rangeMatch[1] : `${rangeMatch[1]} ${year}`
      const startParsed = parseDate(startRaw)
      start_date = startParsed
      end_date = endParsed !== startParsed ? endParsed : null
    } else {
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

    // Time — look for patterns like "10:00am – 5:00pm" or "2pm"
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

    // Venue / online
    const isOnline = /\bonline\b|\bvirtual\b|\bwebinar\b/i.test(html)
    let venue: string | null = 'State Library of NSW'
    if (isOnline) venue = null // caller will skip online events

    return { title, description, start_date, end_date, start_time, end_time, venue, is_online: isOnline }
  } catch (err) {
    console.error(`[slnsw] Error fetching event page ${slug}:`, err)
    return null
  }
}

export async function fetchSLNSWEvents(): Promise<RawEvent[]> {
  let listingHtml: string
  try {
    const res = await fetchWithTimeout(WHATS_ON_URL)
    if (!res.ok) {
      console.error(`[slnsw] Listing page returned ${res.status}`)
      return []
    }
    listingHtml = await res.text()
  } catch (err) {
    console.error('[slnsw] Failed to fetch listing page:', err)
    return []
  }

  const slugs = extractSlugs(listingHtml).slice(0, MAX_EVENTS)
  console.log(`[slnsw] Found ${slugs.length} event slugs`)

  const events: RawEvent[] = []

  for (const slug of slugs) {
    const details = await scrapeEventPage(slug)
    if (!details) {
      console.log(`[slnsw] Skipping ${slug}: no details`)
      continue
    }
    if (details.is_online) {
      console.log(`[slnsw] Skipping ${slug}: online event`)
      continue
    }
    if (!details.start_date) {
      console.log(`[slnsw] Skipping ${slug}: no date found`)
      continue
    }

    const event: RawEvent = {
      title: details.title,
      institution: 'State Library of NSW',
      event_type: 'other',
      start_date: details.start_date,
      end_date: details.end_date ?? undefined,
      start_time: details.start_time ?? undefined,
      end_time: details.end_time ?? undefined,
      venue: details.venue ?? 'State Library of NSW',
      suburb: 'Sydney CBD',
      description: details.description || undefined,
      event_url: `${BASE_URL}/events/${slug}`,
      is_free: true,
      tags: ['state-library', 'free'],
      source: 'slnsw',
      source_id: slug,
    }
    events.push(event)
  }

  console.log(`[slnsw] Returning ${events.length} events`)
  return events
}
