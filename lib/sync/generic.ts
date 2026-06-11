import { RawEvent } from './types'
import { SourceDescriptor } from './descriptors'
import {
  BROWSER_HEADERS, GOOGLEBOT_HEADERS, fetchWithTimeout,
  absoluteUrl, slugFromUrl, stripTags, decodeEntities, metaContent,
  extractDescription, jsonLdEventData,
  parseDateRangeText, parseClosingDateText, parseTimeRangeText,
  classifyEventType, detectIsFree, detectOngoing,
} from './scrape'

/**
 * Descriptor-driven generic source adapter.
 *
 * Every listing strategy reduces to "produce candidate detail-page URLs";
 * a shared detail scraper then extracts the event from each page via the
 * standard ladder (JSON-LD → OpenGraph/meta → visible-text patterns).
 */

const DEFAULT_MAX_PAGES = 25

function headersFor(d: SourceDescriptor): Record<string, string> {
  return d.headers === 'googlebot' ? GOOGLEBOT_HEADERS : BROWSER_HEADERS
}

// ── Candidate URL collection ──────────────────────────────────────────────────

function dedupe(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const norm = u.replace(/\/$/, '')
    if (!seen.has(norm)) { seen.add(norm); out.push(norm) }
  }
  return out
}

async function urlsFromListingLinks(d: SourceDescriptor, listingUrl: string, linkPattern: string): Promise<string[]> {
  const res = await fetchWithTimeout(listingUrl, headersFor(d))
  if (!res.ok) { console.error(`[${d.key}] listing page → ${res.status}`); return [] }
  const html = await res.text()
  const re = new RegExp(`href="([^"]+)"`, 'gi')
  const pattern = new RegExp(linkPattern, 'i')
  const urls: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = decodeEntities(m[1])
    if (!pattern.test(href)) continue
    const abs = absoluteUrl(d.baseUrl, href)
    // stay on the institution's own site
    if (!abs.startsWith(d.baseUrl)) continue
    // skip the listing page itself and obvious pagination/filter links
    if (abs.replace(/\/$/, '') === listingUrl.replace(/\/$/, '')) continue
    if (/[?&](page|filter)/i.test(abs)) continue
    urls.push(abs)
  }
  return dedupe(urls)
}

async function urlsFromSitemap(d: SourceDescriptor, sitemapUrl: string | undefined, includePattern: string): Promise<string[]> {
  const candidates = sitemapUrl ? [sitemapUrl] : [`${d.baseUrl.replace(/\/$/, '')}/sitemap.xml`]
  let xml = ''
  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, headersFor(d))
      if (res.ok) { xml = await res.text(); break }
    } catch { /* try next */ }
  }
  if (!xml) { console.error(`[${d.key}] no sitemap found`); return [] }

  // Follow a sitemap index (first few children)
  if (xml.includes('<sitemapindex')) {
    const children = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).slice(0, 3)
    let merged = ''
    for (const child of children) {
      try {
        const res = await fetchWithTimeout(child, headersFor(d))
        if (res.ok) merged += await res.text()
      } catch { /* skip */ }
    }
    xml = merged || xml
  }

  const pattern = new RegExp(includePattern, 'i')
  const urls: string[] = []
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = decodeEntities(m[1].trim())
    if (pattern.test(url)) urls.push(url)
  }
  return dedupe(urls)
}

async function urlsFromRss(d: SourceDescriptor, feedUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(feedUrl, headersFor(d))
  if (!res.ok) { console.error(`[${d.key}] feed → ${res.status}`); return [] }
  const xml = await res.text()
  const urls: string[] = []
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const linkM = item[1].match(/<link>([^<]+)<\/link>/)
    if (linkM) urls.push(absoluteUrl(d.baseUrl, linkM[1].trim()))
  }
  // Atom
  if (urls.length === 0) {
    for (const entry of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
      const hrefM = entry[1].match(/<link[^>]+href="([^"]+)"/)
      if (hrefM) urls.push(absoluteUrl(d.baseUrl, hrefM[1].trim()))
    }
  }
  return dedupe(urls)
}

async function urlsFromWpApi(d: SourceDescriptor, apiUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(apiUrl, { ...headersFor(d), Accept: 'application/json' })
  if (!res.ok) { console.error(`[${d.key}] wp-api → ${res.status}`); return [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts: any[] = await res.json()
  if (!Array.isArray(posts)) return []
  return dedupe(posts.map((p) => String(p.link ?? '')).filter(Boolean))
}

export async function collectCandidateUrls(d: SourceDescriptor): Promise<string[]> {
  const l = d.listing
  switch (l.kind) {
    case 'listing-links': return urlsFromListingLinks(d, l.listingUrl, l.linkPattern)
    case 'sitemap': return urlsFromSitemap(d, l.sitemapUrl, l.includePattern)
    case 'rss': return urlsFromRss(d, l.feedUrl)
    case 'wp-api': return urlsFromWpApi(d, l.apiUrl)
  }
}

// ── Detail page extraction ────────────────────────────────────────────────────

export async function scrapeDetailPage(d: SourceDescriptor, url: string, today: string): Promise<RawEvent | null> {
  let html: string
  try {
    const res = await fetchWithTimeout(url, headersFor(d))
    if (!res.ok) { console.log(`[${d.key}] ${url} → ${res.status}`); return null }
    html = await res.text()
  } catch (err) {
    console.log(`[${d.key}] ${url} fetch error: ${err}`)
    return null
  }

  // Title: og:title (optionally suffix-stripped) → <h1> → <title>
  let title = metaContent(html, 'og:title') ?? ''
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
    if (h1) title = decodeEntities(stripTags(h1[1]))
  }
  if (!title) {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    if (t) title = decodeEntities(stripTags(t[1]))
  }
  if (d.titleSuffixPattern) title = title.replace(new RegExp(d.titleSuffixPattern, 'i'), '').trim()
  title = title.trim()
  if (!title) { console.log(`[${d.key}] ${url}: no title`); return null }

  const description = extractDescription(html)
  const rawImage = metaContent(html, 'og:image')
  const image_url = rawImage ? absoluteUrl(d.baseUrl, rawImage) : undefined

  // Dates ladder: JSON-LD → visible date range → closing-phrase
  const ld = jsonLdEventData(html)
  let start_date = ld.start_date
  let end_date = ld.end_date
  const visibleText = stripTags(html)
  if (!start_date || !end_date) {
    const range = parseDateRangeText(visibleText)
    if (!start_date && range.start) start_date = range.start
    if (!end_date && range.end) end_date = range.end
  }
  if (!end_date) end_date = parseClosingDateText(visibleText)
  if (end_date === start_date) end_date = null

  const ongoing = detectOngoing(html, title)
  if (!start_date && !ongoing) { console.log(`[${d.key}] ${url}: no date`); return null }
  if (end_date && end_date < today) { console.log(`[${d.key}] ${url}: past`); return null }
  if (end_date && start_date && end_date < start_date) {
    console.log(`[${d.key}] ${url}: end before start, dropping end`)
    end_date = null
  }

  const { start_time, end_time } = parseTimeRangeText(visibleText)

  const event_type = classifyEventType(
    `${title} ${description} ${ld.types}`,
    d.defaultEventType ?? 'other',
  )

  const is_free = d.assumeFree ?? detectIsFree(html)
  const isOngoingEvent = ongoing && !end_date
  const tags = [...(d.baseTags ?? [d.key]), is_free ? 'free' : 'ticketed']
  if (isOngoingEvent) tags.push('ongoing')

  return {
    title,
    institution: d.institution,
    event_type,
    start_date: start_date ?? today,
    end_date: end_date ?? undefined,
    start_time: start_time ?? undefined,
    end_time: end_time ?? undefined,
    venue: d.venue ?? d.institution,
    suburb: d.suburb,
    description: description || undefined,
    image_url,
    event_url: url,
    is_free,
    tags,
    source: d.key,
    source_id: slugFromUrl(url),
  }
}

// ── Adapter entry point ───────────────────────────────────────────────────────

export async function fetchDescriptorEvents(d: SourceDescriptor): Promise<RawEvent[]> {
  const today = new Date().toISOString().slice(0, 10)
  let urls: string[]
  try {
    urls = await collectCandidateUrls(d)
  } catch (err) {
    console.error(`[${d.key}] listing failed:`, err)
    return []
  }
  console.log(`[${d.key}] ${urls.length} candidate pages`)

  const events: RawEvent[] = []
  const seen = new Set<string>()
  for (const url of urls.slice(0, d.maxPages ?? DEFAULT_MAX_PAGES)) {
    const event = await scrapeDetailPage(d, url, today)
    if (!event) continue
    if (seen.has(event.source_id)) continue
    seen.add(event.source_id)
    events.push(event)
  }
  console.log(`[${d.key}] returning ${events.length} events`)
  return events
}

/** Registry-compatible fetcher factory. */
export function createGenericSource(d: SourceDescriptor): () => Promise<RawEvent[]> {
  return () => fetchDescriptorEvents(d)
}
