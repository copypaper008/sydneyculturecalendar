import { RawEvent } from '../types'

const BASE_URL = 'https://whiterabbitcollection.org'
const EXHIBITIONS_URL = `${BASE_URL}/exhibitions/`
const FETCH_TIMEOUT_MS = 15_000

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
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

/**
 * Parse White Rabbit date format: "24.06–08.11.2026" or "24.06.2025–08.11.2026"
 * Returns [start_date, end_date] as YYYY-MM-DD strings
 */
function parseWRDates(raw: string): [string | null, string | null] {
  // Normalise dashes
  const s = raw.replace(/[–—]/g, '-').trim()

  // Pattern: DD.MM-DD.MM.YYYY (year only at end)
  const m1 = s.match(/^(\d{1,2})\.(\d{2})-(\d{1,2})\.(\d{2})\.(\d{4})$/)
  if (m1) {
    const year = m1[5]
    const start = `${year}-${m1[2]}-${m1[1].padStart(2, '0')}`
    const end = `${year}-${m1[4]}-${m1[3].padStart(2, '0')}`
    return [start, end]
  }

  // Pattern: DD.MM.YYYY-DD.MM.YYYY (year on both)
  const m2 = s.match(/^(\d{1,2})\.(\d{2})\.(\d{4})-(\d{1,2})\.(\d{2})\.(\d{4})$/)
  if (m2) {
    const start = `${m2[3]}-${m2[2]}-${m2[1].padStart(2, '0')}`
    const end = `${m2[6]}-${m2[5]}-${m2[4].padStart(2, '0')}`
    return [start, end]
  }

  // Single date: DD.MM.YYYY
  const m3 = s.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/)
  if (m3) {
    return [`${m3[3]}-${m3[2]}-${m3[1].padStart(2, '0')}`, null]
  }

  return [null, null]
}

interface WRExhibition {
  title: string
  url: string
  date_raw: string
  start_date: string | null
  end_date: string | null
}

function parseListingPage(html: string): WRExhibition[] {
  const exhibitions: WRExhibition[] = []
  const seen = new Set<string>()

  // Extract exhibition hrefs — White Rabbit uses /exhibitions/slug/ paths
  const hrefRe = /href="((?:https?:\/\/whiterabbitcollection\.org)?\/exhibitions\/([^/"#][^"#]*))"/gi
  const links: string[] = []
  const linkSeen = new Set<string>()
  let lm: RegExpExecArray | null
  while ((lm = hrefRe.exec(html)) !== null) {
    const raw = lm[1]
    const url = (raw.startsWith('http') ? raw : `${BASE_URL}${raw}`).replace(/\/$/, '')
    // Skip the exhibitions root page itself
    if (url === `${BASE_URL}/exhibitions` || url === EXHIBITIONS_URL.replace(/\/$/, '')) continue
    if (!linkSeen.has(url)) { linkSeen.add(url); links.push(url) }
  }

  console.log(`[whiterabbit] Listing HTML: ${html.length} chars, found ${links.length} exhibition links`)

  // Date pattern in the HTML: e.g. "24.06–08.11.2026"
  const dateRe = /(\d{1,2}\.\d{2}[–—-]\d{1,2}\.\d{2}\.\d{4}|\d{1,2}\.\d{2}\.\d{4}[–—-]\d{1,2}\.\d{2}\.\d{4}|\d{1,2}\.\d{2}\.\d{4})/g

  for (const url of links) {
    const slug = url.split('/').filter(Boolean).pop()!
    if (seen.has(slug)) continue
    seen.add(slug)

    // Find title and date from context around this URL in the HTML
    const idx = html.indexOf(`"${url.replace(BASE_URL, '')}"`)
    const ctxStart = Math.max(0, idx - 800)
    const ctxEnd = Math.min(html.length, idx + 800)
    const ctx = html.slice(ctxStart, ctxEnd)

    // Title from h2/h3 near the link
    const titleM = ctx.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/)
    const title = titleM ? decodeEntities(stripTags(titleM[1])).trim() : ''
    if (!title || title.length < 2) continue

    // Date
    dateRe.lastIndex = 0
    const dateM = dateRe.exec(ctx)
    const date_raw = dateM ? dateM[1] : ''
    const [start_date, end_date] = date_raw ? parseWRDates(date_raw) : [null, null]

    exhibitions.push({ title, url, date_raw, start_date, end_date })
  }

  return exhibitions
}

async function scrapeExhibitionPage(url: string): Promise<{ image_url: string | null; description: string }> {
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return { image_url: null, description: '' }
    const html = await res.text()
    const imgM = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    const image_url = imgM ? imgM[1] : null
    const descM = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/)
    const description = descM ? decodeEntities(descM[1]) : ''
    return { image_url, description }
  } catch {
    return { image_url: null, description: '' }
  }
}

async function tryAlternativeSources(): Promise<RawEvent[]> {
  const today = new Date().toISOString().split('T')[0]
  // Try WordPress REST API — often accessible even when main site blocks cloud IPs
  const apiUrls = [
    `${BASE_URL}/wp-json/wp/v2/posts?per_page=20&categories=exhibitions&_fields=id,title,slug,link,date,excerpt,content`,
    `${BASE_URL}/wp-json/wp/v2/posts?per_page=20&_fields=id,title,slug,link,date,excerpt`,
    `${BASE_URL}/wp-json/wp/v2/exhibition?per_page=20&_fields=id,title,slug,link,date,excerpt`,
  ]
  for (const url of apiUrls) {
    try {
      const res = await fetchWithTimeout(url)
      console.log(`[whiterabbit] WP API ${url} → ${res.status}`)
      if (!res.ok) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts: any[] = await res.json()
      if (!Array.isArray(posts) || posts.length === 0) continue
      const events: RawEvent[] = []
      for (const post of posts) {
        const title = decodeEntities(stripTags(post.title?.rendered ?? '')).trim()
        if (!title) continue
        const slug = post.slug ?? title.toLowerCase().replace(/\s+/g, '-')
        const postUrl = post.link ?? `${BASE_URL}/exhibitions/${slug}/`
        // Dates from post date or excerpt text
        const rawDate = String(post.date ?? '').slice(0, 10)
        const start_date = rawDate >= today ? rawDate : today
        events.push({
          title,
          institution: 'White Rabbit Gallery',
          event_type: 'exhibition',
          start_date,
          venue: 'White Rabbit Gallery',
          suburb: 'Chippendale',
          description: decodeEntities(stripTags(post.excerpt?.rendered ?? '')).trim() || undefined,
          event_url: postUrl,
          is_free: true,
          tags: ['white-rabbit', 'free', 'contemporary-art', 'chinese-art'],
          source: 'whiterabbit',
          source_id: slug,
        })
      }
      if (events.length > 0) {
        console.log(`[whiterabbit] WP API returned ${events.length} posts`)
        return events
      }
    } catch (err) {
      console.log(`[whiterabbit] WP API error: ${err}`)
    }
  }

  // Try RSS feed
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/exhibitions/feed/`)
    console.log(`[whiterabbit] RSS feed → ${res.status}`)
    if (res.ok) {
      const xml = await res.text()
      const events: RawEvent[] = []
      const itemRe = /<item>([\s\S]*?)<\/item>/gi
      let im: RegExpExecArray | null
      while ((im = itemRe.exec(xml)) !== null) {
        const item = im[1]
        const titleM = item.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) ?? item.match(/<title>([^<]+)<\/title>/)
        const title = titleM ? decodeEntities(titleM[1]).trim() : ''
        if (!title) continue
        const linkM = item.match(/<link>([^<]+)<\/link>/)
        const link = linkM ? linkM[1].trim() : ''
        const slug = link.split('/').filter(Boolean).pop() ?? title.toLowerCase().replace(/\s+/g, '-')
        const pubDateM = item.match(/<pubDate>([^<]+)<\/pubDate>/)
        const start_date = pubDateM ? new Date(pubDateM[1]).toISOString().slice(0, 10) : today
        if (start_date < today) continue
        events.push({
          title,
          institution: 'White Rabbit Gallery',
          event_type: 'exhibition',
          start_date,
          venue: 'White Rabbit Gallery',
          suburb: 'Chippendale',
          event_url: link || `${EXHIBITIONS_URL}${slug}/`,
          is_free: true,
          tags: ['white-rabbit', 'free', 'contemporary-art', 'chinese-art'],
          source: 'whiterabbit',
          source_id: slug,
        })
      }
      if (events.length > 0) {
        console.log(`[whiterabbit] RSS returned ${events.length} items`)
        return events
      }
    }
  } catch { /* skip */ }

  return []
}

export async function fetchWhiteRabbitEvents(): Promise<RawEvent[]> {
  let html: string
  try {
    const res = await fetchWithTimeout(EXHIBITIONS_URL)
    if (!res.ok) {
      console.error(`[whiterabbit] Listing page returned ${res.status} — trying alternative sources`)
      return tryAlternativeSources()
    }
    html = await res.text()
  } catch (err) {
    console.error('[whiterabbit] Failed to fetch listing page:', err)
    return []
  }

  const parsed = parseListingPage(html)
  const today = new Date().toISOString().split('T')[0]
  const events: RawEvent[] = []

  for (const ex of parsed) {
    if (ex.end_date && ex.end_date < today) {
      console.log(`[whiterabbit] Skipping "${ex.title}": past (${ex.end_date})`)
      continue
    }
    if (!ex.start_date) {
      console.log(`[whiterabbit] Skipping "${ex.title}": no date (raw: "${ex.date_raw}")`)
      continue
    }

    const { image_url, description } = await scrapeExhibitionPage(ex.url)
    const slug = ex.url.split('/').filter(Boolean).pop()!

    events.push({
      title: ex.title,
      institution: 'White Rabbit Gallery',
      event_type: 'exhibition',
      start_date: ex.start_date,
      end_date: ex.end_date ?? undefined,
      venue: 'White Rabbit Gallery',
      suburb: 'Chippendale',
      description: description || undefined,
      image_url: image_url ?? undefined,
      event_url: ex.url,
      is_free: true,
      tags: ['white-rabbit', 'free', 'contemporary-art', 'chinese-art'],
      source: 'whiterabbit',
      source_id: slug,
    })
  }

  console.log(`[whiterabbit] Returning ${events.length} events`)
  return events
}
