import { RawEvent } from '../types'
import { createGenericSource } from '../generic'
import { sourceDescriptors } from '@/config/sources'
import { fetchSLNSWEvents } from './slnsw'
import { fetchMCAEvents } from './mca'
import { fetchAGNSWEvents } from './agnsw'
import { fetchPowerhouseEvents } from './powerhouse'
import { fetchAustralianMuseumEvents } from './ausmuseum'
import { fetchMaritimeEvents } from './maritime'
import { fetchWhiteRabbitEvents } from './whiterabbit'

export type SourceFetcher = () => Promise<RawEvent[]>

/**
 * All available source adapters, keyed by source id. Which ones actually run
 * is decided by siteConfig.sync.sources.
 *
 * Two kinds are merged here:
 *  - hand-written adapters (below) for sites too irregular for the
 *    descriptor model;
 *  - declarative descriptors from config/sources.ts, executed by the generic
 *    adapter. Create these with `npm run add-source -- <url> …`.
 */
export const sourceRegistry: Record<string, SourceFetcher> = {
  slnsw: fetchSLNSWEvents,
  mca: fetchMCAEvents,
  agnsw: fetchAGNSWEvents,
  powerhouse: fetchPowerhouseEvents,
  ausmuseum: fetchAustralianMuseumEvents,
  maritime: fetchMaritimeEvents,
  whiterabbit: fetchWhiteRabbitEvents,
  ...Object.fromEntries(sourceDescriptors.map((d) => [d.key, createGenericSource(d)])),
}
