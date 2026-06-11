import { RawEvent } from '../types'
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
 * is decided by siteConfig.sync.sources — a new city deployment registers its
 * adapters here and lists the enabled keys in its config.
 */
export const sourceRegistry: Record<string, SourceFetcher> = {
  slnsw: fetchSLNSWEvents,
  mca: fetchMCAEvents,
  agnsw: fetchAGNSWEvents,
  powerhouse: fetchPowerhouseEvents,
  ausmuseum: fetchAustralianMuseumEvents,
  maritime: fetchMaritimeEvents,
  whiterabbit: fetchWhiteRabbitEvents,
}
