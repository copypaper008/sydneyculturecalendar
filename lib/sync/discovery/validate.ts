import { RawEvent } from '../types'

/**
 * Quality gate for a source's output — run before registering a descriptor
 * (and usable as a health check on existing sources).
 */

export interface ValidationReport {
  pass: boolean
  errors: string[]
  warnings: string[]
  stats: {
    total: number
    withEndDate: number
    withDescription: number
    withImage: number
    freeCount: number
    typeCounts: Record<string, number>
    dateRange: [string, string] | null
  }
}

export interface ValidationOptions {
  minEvents?: number
  /** Sanity window for start dates, in years before/after today. */
  pastYears?: number
  futureYears?: number
}

const JUNK_TITLES = /^(events?|exhibitions?|what'?s\s*on|home|search|tickets?|visit|about|news)$/i
const ISO = /^\d{4}-\d{2}-\d{2}$/

export function validateRawEvents(events: RawEvent[], opts: ValidationOptions = {}): ValidationReport {
  const { minEvents = 3, pastYears = 2, futureYears = 3 } = opts
  const errors: string[] = []
  const warnings: string[] = []

  const today = new Date()
  const earliest = `${today.getFullYear() - pastYears}-01-01`
  const latest = `${today.getFullYear() + futureYears}-12-31`

  if (events.length < minEvents) {
    errors.push(`Only ${events.length} events extracted (minimum ${minEvents}). The strategy is probably not finding real event pages.`)
  }

  const ids = new Set<string>()
  let dupes = 0
  let outOfWindow = 0
  for (const e of events) {
    const label = e.source_id || e.title || '?'
    if (!e.title || e.title.trim().length < 3) errors.push(`${label}: empty/too-short title`)
    else if (JUNK_TITLES.test(e.title.trim())) errors.push(`${label}: title "${e.title}" looks like navigation, not an event`)
    if (!ISO.test(e.start_date)) errors.push(`${label}: start_date "${e.start_date}" is not YYYY-MM-DD`)
    if (e.end_date && !ISO.test(e.end_date)) errors.push(`${label}: end_date "${e.end_date}" is not YYYY-MM-DD`)
    if (e.end_date && ISO.test(e.end_date) && ISO.test(e.start_date) && e.end_date < e.start_date) {
      errors.push(`${label}: end_date ${e.end_date} before start_date ${e.start_date}`)
    }
    if (!/^https?:\/\//.test(e.event_url)) errors.push(`${label}: event_url "${e.event_url}" is not absolute`)
    if (!e.source_id) errors.push(`${e.title}: missing source_id`)
    if (ids.has(e.source_id)) dupes++
    ids.add(e.source_id)
    if (ISO.test(e.start_date) && (e.start_date < earliest || e.start_date > latest)) outOfWindow++
  }
  if (dupes > 0) errors.push(`${dupes} duplicate source_ids`)
  if (outOfWindow > 0) {
    const msg = `${outOfWindow}/${events.length} start dates fall outside ${earliest}..${latest}`
    if (outOfWindow > events.length / 2) errors.push(msg + ' — date extraction is probably picking up the wrong text')
    else warnings.push(msg)
  }

  const withEndDate = events.filter((e) => e.end_date).length
  const withDescription = events.filter((e) => e.description).length
  const withImage = events.filter((e) => e.image_url).length
  if (events.length > 0) {
    if (withDescription / events.length < 0.5) warnings.push(`Only ${withDescription}/${events.length} events have a description`)
    if (withImage / events.length < 0.5) warnings.push(`Only ${withImage}/${events.length} events have an image`)
    if (withEndDate === 0) warnings.push('No event has an end date — multi-day exhibitions will render as "Closing TBA"')
    const titles = new Set(events.map((e) => e.title))
    if (titles.size === 1 && events.length > 1) errors.push(`All ${events.length} events share the title "${events[0].title}" — extraction is grabbing site chrome`)
    const dates = new Set(events.map((e) => e.start_date))
    if (dates.size === 1 && events.length > 2) warnings.push('All events share one start date — verify dates are per-event, not site-wide')
  }

  const typeCounts: Record<string, number> = {}
  for (const e of events) typeCounts[e.event_type] = (typeCounts[e.event_type] ?? 0) + 1

  const sorted = events.map((e) => e.start_date).filter((d) => ISO.test(d)).sort()
  return {
    pass: errors.length === 0,
    errors,
    warnings,
    stats: {
      total: events.length,
      withEndDate,
      withDescription,
      withImage,
      freeCount: events.filter((e) => e.is_free).length,
      typeCounts,
      dateRange: sorted.length ? [sorted[0], sorted[sorted.length - 1]] : null,
    },
  }
}
