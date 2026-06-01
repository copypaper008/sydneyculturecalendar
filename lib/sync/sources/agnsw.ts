import { RawEvent } from '../types'

const BASE_URL = 'https://www.artgallery.nsw.gov.au'
const EXHIBITIONS_URL = `${BASE_URL}/whats-on/exhibitions/`
const EVENTS_URL = `${BASE_URL}/whats-on/events/`
const FETCH_TIMEOUT_MS = 12_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://www.artgallery.nsw.gov.au/',
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

interface CardData {
  url: string
  title: string
  start_date: string
  end_date: string | null
  location: string
  is_free: boolean
  event_type: string
  image_url: string | null
}

/** Parse all event/exhibition cards from a listing page */
function parseCards(html: string, defaultType: string): CardData[] {
  const cards: CardData[] = []

  // Match each <article ...> block
  const articleRe = /<article\s([^>]*)>([\s\S]*?)<\/article>/gi
  let articleMatch: RegExpExecArray | null

  while ((articleMatch = articleRe.exec(html)) !== null) {
    const attrs = articleMatch[1]
    const body = articleMatch[2]

    // data-startdate / data-enddate already in YYYY-MM-DD
    const startDateM = attrs.match(/data-startdate="(\d{4}-\d{2}-\d{2})"/)
    if (!startDateM) continue
    const start_date = startDateM[1]

    const endDateM = attrs.match(/data-enddate="(\d{4}-\d{2}-\d{2})"/)
    const end_date = endDateM ? endDateM[1] : null

    // Location from data-location
    const locationM = attrs.match(/data-location="([^"]+)"/)
    const location = locationM ? decodeEntities(locationM[1]) : 'Art Gallery of NSW'

    // Event URL
    const hrefM = body.match(/href="(\/whats-on\/[^"]+)"/)
    if (!hrefM) continue
    const url = `${BASE_URL}${hrefM[1]}`

    // Title — card-title heading, strip inner card-subtitle span
    const titleM = body.match(/<h[2-5][^>]*class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\/h[2-5]>/)
    if (!titleM) continue
    // Get subtitle separately then build full title
    const subtitleM = titleM[1].match(/<span[^>]*class="[^"]*card-subtitle[^"]*"[^>]*>([\s\S]*?)<\/span>/)
    const mainTitle = decodeEntities(stripTags(titleM[1].replace(/<span[^>]*class="[^"]*card-subtitle[^"]*"[^>]*>[\s\S]*?<\/span>/g, ''))).trim()
    const subtitle = subtitleM ? decodeEntities(stripTags(subtitleM[1])).trim() : ''
    const title = subtitle ? `${mainTitle}: ${subtitle}` : mainTitle
    if (!title) continue

    // Free / charges apply
    const priceM = body.match(/class="[^"]*card-priceSummary[^"]*"[^>]*>([\s\S]*?)<\/p>/)
    const priceText = priceM ? stripTags(priceM[1]).toLowerCase() : ''
    const is_free = !priceText.includes('charge') && !priceText.includes('ticket') && !priceText.includes('fee')

    // Event type from card label/class
    const labelM = body.match(/class="[^"]*card-label[^"]*"[^>]*>([\s\S]*?)<\/p>/)
    const labelText = labelM ? stripTags(labelM[1]).toLowerCase() : ''
    let event_type = defaultType
    if (labelText.includes('talk') || labelText.includes('lecture') || labelText.includes('conversation')) event_type = 'talk'
    else if (labelText.includes('tour') || labelText.includes('walk')) event_type = 'heritage'
    else if (labelText.includes('performance') || labelText.includes('live')) event_type = 'performance'
    else if (labelText.includes('festival')) event_type = 'festival'

    // Image — look for src inside card-imageContainer
    const imgContainerM = body.match(/class="[^"]*card-imageContainer[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/)
    const imgSrcM = imgContainerM ? null : body.match(/<img[^>]+src="([^"]+)"/)
    const rawSrc = imgContainerM
      ? (body.match(/class="[^"]*card-imageContainer[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/) ?? [])[1]
      : (imgSrcM ?? [])[1]
    const image_url = rawSrc
      ? (rawSrc.startsWith('http') ? rawSrc : `${BASE_URL}${rawSrc}`)
      : null

    cards.push({ url, title, start_date, end_date, location, is_free, event_type, image_url })
  }

  return cards
}

/** Fetch og:description and og:image from an individual event page */
async function scrapeEventPage(url: string): Promise<{ description: string; image_url: string | null; start_time: string | null; end_time: string | null }> {
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return { description: '', image_url: null, start_time: null, end_time: null }
    const html = await res.text()

    const descM = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/)
    const description = descM ? decodeEntities(descM[1]) : ''

    let image_url: string | null = null
    const ogImgM = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    if (ogImgM) image_url = ogImgM[1].startsWith('http') ? ogImgM[1] : `${BASE_URL}${ogImgM[1]}`

    let start_time: string | null = null
    let end_time: string | null = null
    const timeRangeM = html.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–\-—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
    if (timeRangeM) {
      start_time = parseTime(timeRangeM[1])
      end_time = parseTime(timeRangeM[2])
    }

    return { description, image_url, start_time, end_time }
  } catch {
    return { description: '', image_url: null, start_time: null, end_time: null }
  }
}

async function scrapeListingPage(url: string, defaultType: string): Promise<RawEvent[]> {
  let html: string
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) {
      console.error(`[agnsw] ${url} returned ${res.status}`)
      return []
    }
    html = await res.text()
  } catch (err) {
    console.error(`[agnsw] Failed to fetch ${url}:`, err)
    return []
  }

  const cards = parseCards(html, defaultType)
  console.log(`[agnsw] Found ${cards.length} cards on ${url}`)

  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []

  for (const card of cards) {
    if (card.start_date < today && (!card.end_date || card.end_date < today)) {
      console.log(`[agnsw] Skipping "${card.title}": past event`)
      continue
    }

    const slug = card.url.split('/').filter(Boolean).pop() ?? card.title.toLowerCase().replace(/\s+/g, '-')

    // Fetch individual page for description, better image, and times
    const detail = await scrapeEventPage(card.url)

    events.push({
      title: card.title,
      institution: 'Art Gallery of NSW',
      event_type: card.event_type,
      start_date: card.start_date,
      end_date: card.end_date ?? undefined,
      start_time: detail.start_time ?? undefined,
      end_time: detail.end_time ?? undefined,
      venue: card.location,
      suburb: 'Sydney CBD',
      description: detail.description || undefined,
      image_url: detail.image_url ?? card.image_url ?? undefined,
      event_url: card.url,
      is_free: card.is_free,
      tags: ['agnsw', card.is_free ? 'free' : 'ticketed'],
      source: 'agnsw',
      source_id: slug,
    })
  }

  return events
}

export async function fetchAGNSWEvents(): Promise<RawEvent[]> {
  const [exhibitions, events] = await Promise.all([
    scrapeListingPage(EXHIBITIONS_URL, 'exhibition'),
    scrapeListingPage(EVENTS_URL, 'other'),
  ])

  // Deduplicate by source_id in case an event appears on both pages
  const seen = new Set<string>()
  const all: RawEvent[] = []
  for (const e of [...exhibitions, ...events]) {
    if (!seen.has(e.source_id)) {
      seen.add(e.source_id)
      all.push(e)
    }
  }

  console.log(`[agnsw] Returning ${all.length} events total`)
  return all
}
