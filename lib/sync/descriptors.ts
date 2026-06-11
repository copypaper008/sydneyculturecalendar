/**
 * Declarative source descriptors.
 *
 * A SourceDescriptor is pure data describing how to scrape one institution.
 * The generic adapter (lib/sync/generic.ts) executes it; the discovery probe
 * (lib/sync/discovery/probe.ts) drafts one from a URL; the validator
 * (lib/sync/discovery/validate.ts) checks its output quality.
 *
 * Descriptors are preferred over hand-written adapter code: they are safe to
 * execute, reviewable as data in a PR, and testable with one command
 * (`npm run add-source`). Write a bespoke adapter only when a site is too
 * weird for the descriptor model (e.g. dates buried in client-side JSON).
 */

/** How to obtain the list of candidate event-detail URLs. */
export type ListingStrategy =
  | {
      kind: 'listing-links'
      /** Page whose HTML contains links to individual events. */
      listingUrl: string
      /** Regex (string) an href must match, e.g. "/whats-on/[a-z0-9-]+". */
      linkPattern: string
    }
  | {
      kind: 'sitemap'
      /** Defaults to {baseUrl}/sitemap.xml; sitemap indexes are followed. */
      sitemapUrl?: string
      /** Regex (string) a <loc> URL must match. */
      includePattern: string
    }
  | {
      kind: 'rss'
      feedUrl: string
    }
  | {
      kind: 'wp-api'
      /** WordPress REST collection URL returning an array of posts. */
      apiUrl: string
    }

export interface SourceDescriptor {
  /** Registry key and `source` column value. */
  key: string
  institution: string
  /** Origin used to absolutise relative URLs, e.g. "https://museum.example". */
  baseUrl: string
  listing: ListingStrategy
  /** Cap on detail pages fetched per sync (default 25). */
  maxPages?: number
  venue?: string
  suburb?: string
  /** Tags applied to every event from this source. */
  baseTags?: string[]
  /** Header preset; 'googlebot' helps with some bot-blocked sites. */
  headers?: 'browser' | 'googlebot'
  /** Event type when classification finds no signal (default 'other'). */
  defaultEventType?: string
  /** Skip free-detection and mark everything free (e.g. public libraries). */
  assumeFree?: boolean
  /** Regex (string) stripped from the end of og:title, e.g. "\\s*\\|\\s*Some Museum$". */
  titleSuffixPattern?: string
  /**
   * Fetch pages through a real browser (for JS-rendered sites). Requires
   * BROWSER_WS_ENDPOINT or CHROME_EXECUTABLE_PATH; falls back to plain HTTP
   * with a warning when neither is configured. Slower — keep maxPages low.
   */
  render?: boolean
}
