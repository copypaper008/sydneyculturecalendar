import { SourceDescriptor, ListingStrategy } from '../descriptors'
import {
  BROWSER_HEADERS, GOOGLEBOT_HEADERS, fetchWithTimeout,
  absoluteUrl, decodeEntities, extractJsonLd, metaContent,
} from '../scrape'

/**
 * Source discovery probe.
 *
 * Given an institution's what's-on URL, detect which scraping strategies the
 * site supports and draft a SourceDescriptor for the best one. Fully
 * deterministic — no LLM. See `npm run add-source`.
 */

export interface LinkGroup {
  /** Path prefix shared by the group, e.g. "/whats-on/". */
  prefix: string
  count: number
  /** Whether the prefix contains event-ish keywords. */
  keywordHit: boolean
  sampleUrls: string[]
  /** Suggested href regex for a listing-links strategy. */
  linkPattern: string
}

export interface ProbeReport {
  url: string
  baseUrl: string
  fetchedWith: 'browser' | 'googlebot' | null
  status: number | null
  capabilities: {
    jsonLdEventCount: number
    hasNextData: boolean
    rssFeedUrl: string | null
    wpApiUrl: string | null
    sitemapUrl: string | null
    sitemapMatchCount: number
    robotsDisallowsPath: boolean
  }
  linkGroups: LinkGroup[]
  detailSample: {
    url: string
    hasOgTitle: boolean
    hasOgDescription: boolean
    hasOgImage: boolean
    hasJsonLdDates: boolean
  } | null
  recommended: ListingStrategy | null
  confidence: 'high' | 'medium' | 'low'
  notes: string[]
  draft: SourceDescriptor | null
}

const EVENT_KEYWORDS = /event|whats-on|what-s-on|whatson|exhibition|program|calendar|show/i

async function tryFetch(url: string): Promise<{ html: string; status: number; via: 'browser' | 'googlebot' } | null> {
  for (const [via, headers] of [['browser', BROWSER_HEADERS], ['googlebot', GOOGLEBOT_HEADERS]] as const) {
    try {
      const res = await fetchWithTimeout(url, headers)
      if (res.ok) return { html: await res.text(), status: res.status, via }
      if (via === 'googlebot') return { html: '', status: res.status, via }
    } catch { /* try next */ }
  }
  return null
}

/** Group internal links by leading path segment(s) and score event-likeness. */
export function groupLinks(html: string, baseUrl: string, pageUrl: string): LinkGroup[] {
  const groups = new Map<string, Set<string>>()
  for (const m of html.matchAll(/href="([^"#?]+)[^"]*"/gi)) {
    const href = decodeEntities(m[1])
    let abs: URL
    try { abs = new URL(absoluteUrl(baseUrl, href)) } catch { continue }
    if (!abs.toString().startsWith(baseUrl)) continue
    const segments = abs.pathname.split('/').filter(Boolean)
    if (segments.length < 2) continue // need a prefix + a slug
    const slug = segments[segments.length - 1]
    if (!/^[a-z0-9][a-z0-9-]{2,}$/i.test(slug)) continue
    const prefix = '/' + segments.slice(0, -1).join('/') + '/'
    if (abs.pathname.replace(/\/$/, '') === new URL(pageUrl).pathname.replace(/\/$/, '')) continue
    if (!groups.has(prefix)) groups.set(prefix, new Set())
    groups.get(prefix)!.add(abs.toString())
  }

  return [...groups.entries()]
    .map(([prefix, urls]) => ({
      prefix,
      count: urls.size,
      keywordHit: EVENT_KEYWORDS.test(prefix),
      sampleUrls: [...urls].slice(0, 3),
      linkPattern: `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z0-9-]+`,
    }))
    .filter((g) => g.count >= 3)
    .sort((a, b) => Number(b.keywordHit) - Number(a.keywordHit) || b.count - a.count)
}

async function findRssFeed(html: string, baseUrl: string): Promise<string | null> {
  const linkM = html.match(/<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]+href="([^"]+)"/i)
    ?? html.match(/<link[^>]+href="([^"]+)"[^>]+type="application\/(?:rss|atom)\+xml"/i)
  if (linkM) return absoluteUrl(baseUrl, linkM[1])
  for (const path of ['/feed/', '/rss.xml', '/feed.xml']) {
    try {
      const res = await fetchWithTimeout(baseUrl.replace(/\/$/, '') + path)
      if (res.ok) {
        const body = await res.text()
        if (/<(rss|feed)[\s>]/i.test(body)) return baseUrl.replace(/\/$/, '') + path
      }
    } catch { /* skip */ }
  }
  return null
}

async function findWpApi(baseUrl: string): Promise<string | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts?per_page=5`
  try {
    const res = await fetchWithTimeout(url, { ...BROWSER_HEADERS, Accept: 'application/json' })
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json) && json.length > 0 ? url : null
  } catch {
    return null
  }
}

async function findSitemap(baseUrl: string, pathHint: RegExp): Promise<{ url: string; matches: number } | null> {
  const candidates = [`${baseUrl.replace(/\/$/, '')}/sitemap.xml`, `${baseUrl.replace(/\/$/, '')}/sitemap_index.xml`]
  // robots.txt may declare the sitemap
  try {
    const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/robots.txt`)
    if (res.ok) {
      const robots = await res.text()
      for (const m of robots.matchAll(/^sitemap:\s*(\S+)/gim)) candidates.unshift(m[1])
    }
  } catch { /* skip */ }

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) continue
      let xml = await res.text()
      if (!/<(urlset|sitemapindex)[\s>]/i.test(xml)) continue
      if (xml.includes('<sitemapindex')) {
        const children = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).slice(0, 3)
        let merged = ''
        for (const child of children) {
          try {
            const childRes = await fetchWithTimeout(child)
            if (childRes.ok) merged += await childRes.text()
          } catch { /* skip */ }
        }
        if (merged) xml = merged
      }
      const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].filter((m) => pathHint.test(m[1])).length
      return { url, matches }
    } catch { /* try next */ }
  }
  return null
}

async function robotsDisallows(baseUrl: string, path: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/robots.txt`)
    if (!res.ok) return false
    const robots = await res.text()
    let inStarSection = false
    for (const line of robots.split('\n')) {
      const ua = line.match(/^user-agent:\s*(.+)/i)
      if (ua) inStarSection = ua[1].trim() === '*'
      const dis = line.match(/^disallow:\s*(\S+)/i)
      if (inStarSection && dis && path.startsWith(dis[1].replace(/\*$/, ''))) return true
    }
  } catch { /* skip */ }
  return false
}

export async function probe(url: string, institution?: string): Promise<ProbeReport> {
  const parsed = new URL(url)
  const baseUrl = `${parsed.protocol}//${parsed.host}`
  const notes: string[] = []

  const report: ProbeReport = {
    url, baseUrl,
    fetchedWith: null, status: null,
    capabilities: {
      jsonLdEventCount: 0, hasNextData: false,
      rssFeedUrl: null, wpApiUrl: null,
      sitemapUrl: null, sitemapMatchCount: 0,
      robotsDisallowsPath: false,
    },
    linkGroups: [], detailSample: null,
    recommended: null, confidence: 'low', notes, draft: null,
  }

  const page = await tryFetch(url)
  if (!page || !page.html) {
    report.status = page?.status ?? null
    notes.push(`Could not fetch the page (status ${page?.status ?? 'network error'}). The site may block this machine's IP — try running from another network, or the site needs a bespoke adapter.`)
    return report
  }
  report.fetchedWith = page.via
  report.status = page.status
  if (page.via === 'googlebot') notes.push('Browser headers were blocked; Googlebot headers worked. Descriptor will use the googlebot preset.')

  const html = page.html
  report.capabilities.hasNextData = /<script[^>]+id="__NEXT_DATA__"/.test(html)
  report.capabilities.jsonLdEventCount = extractJsonLd(html)
    .filter((b) => /event|exhibition/i.test(String(b?.['@type'] ?? '')) && b?.startDate).length

  report.capabilities.robotsDisallowsPath = await robotsDisallows(baseUrl, parsed.pathname)
  if (report.capabilities.robotsDisallowsPath) {
    notes.push(`robots.txt disallows ${parsed.pathname} — do not scrape this path; look for an API/feed or ask the institution.`)
  }

  report.linkGroups = groupLinks(html, baseUrl, url)
  report.capabilities.rssFeedUrl = await findRssFeed(html, baseUrl)
  report.capabilities.wpApiUrl = await findWpApi(baseUrl)

  const pathHint = report.linkGroups[0]
    ? new RegExp(report.linkGroups[0].prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : new RegExp(parsed.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.', 'i')
  const sitemap = await findSitemap(baseUrl, pathHint)
  if (sitemap) {
    report.capabilities.sitemapUrl = sitemap.url
    report.capabilities.sitemapMatchCount = sitemap.matches
  }

  // Sample a detail page from the best link group
  const top = report.linkGroups[0]
  if (top?.sampleUrls[0]) {
    const sample = await tryFetch(top.sampleUrls[0])
    if (sample?.html) {
      const ld = extractJsonLd(sample.html)
      report.detailSample = {
        url: top.sampleUrls[0],
        hasOgTitle: !!metaContent(sample.html, 'og:title'),
        hasOgDescription: !!metaContent(sample.html, 'og:description'),
        hasOgImage: !!metaContent(sample.html, 'og:image'),
        hasJsonLdDates: ld.some((b) => b?.startDate),
      }
    }
  }

  // ── Recommendation ──────────────────────────────────────────────────────────
  if (!report.capabilities.robotsDisallowsPath) {
    if (top && top.count >= 3) {
      report.recommended = { kind: 'listing-links', listingUrl: url, linkPattern: top.linkPattern }
      report.confidence = top.keywordHit && (report.detailSample?.hasJsonLdDates || report.detailSample?.hasOgTitle) ? 'high' : 'medium'
    } else if (sitemap && sitemap.matches >= 3) {
      report.recommended = { kind: 'sitemap', sitemapUrl: sitemap.url, includePattern: pathHint.source }
      report.confidence = 'medium'
      notes.push('No usable links found on the listing page (likely JS-rendered) — falling back to the sitemap.')
    } else if (report.capabilities.rssFeedUrl) {
      report.recommended = { kind: 'rss', feedUrl: report.capabilities.rssFeedUrl }
      report.confidence = 'medium'
    } else if (report.capabilities.wpApiUrl) {
      report.recommended = { kind: 'wp-api', apiUrl: report.capabilities.wpApiUrl }
      report.confidence = 'low'
      notes.push('Only the WordPress posts API was found; posts may not be events. Review the sample output carefully.')
    } else {
      notes.push('No strategy detected. The site is likely fully JS-rendered with no feed/sitemap — it needs a bespoke adapter (see lib/sync/sources/maritime.ts for the pattern).')
    }
  }

  if (report.capabilities.hasNextData && report.confidence !== 'high') {
    notes.push('Site is a client-rendered Next.js app — dates may be missing from the HTML. If validation finds no dates, a bespoke adapter reading __NEXT_DATA__ may be needed.')
  }

  if (report.recommended) {
    const slug = parsed.host.replace(/^www\./, '').split('.')[0]
    report.draft = {
      key: slug,
      institution: institution ?? slug,
      baseUrl,
      listing: report.recommended,
      ...(page.via === 'googlebot' ? { headers: 'googlebot' as const } : {}),
      baseTags: [slug],
    }
  }

  return report
}
