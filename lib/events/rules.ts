import { Event } from '@/lib/types';
import { RawEvent } from '@/lib/sync/types';
import { siteConfig } from '@/config/site';
import { monthsAgoISO, todayISO } from '@/lib/format';

/**
 * Editorial business rules, parameterised by siteConfig.rules.
 * Documented in docs/PLATFORM_SPEC.md §7.
 */

const { rules } = siteConfig;

/** Audience filter — e.g. school-targeted events are hidden everywhere. */
export function matchesExclusions(title: string, description?: string): boolean {
  return rules.excludePatterns.some(
    (re) => re.test(title) || re.test(description ?? '')
  );
}

/** Whether an event is tagged as permanent / ongoing. */
export function isOngoing(event: { tags?: string[] | null }): boolean {
  return Array.isArray(event.tags) && event.tags.includes(rules.ongoingTag);
}

/**
 * Display filter applied to every event list:
 * 1. audience exclusions
 * 2. definitively past events (end_date < today)
 * 3. staleness — no end date, not ongoing, started > staleAfterMonths ago
 */
export function displayFilter(events: Event[]): Event[] {
  const today = todayISO();
  const cutoff = monthsAgoISO(today, rules.staleAfterMonths);

  return events.filter((e) => {
    if (matchesExclusions(e.title, e.description)) return false;
    if (e.end_date && e.end_date < today) return false;
    if (!e.end_date && !isOngoing(e) && e.start_date < cutoff) return false;
    return true;
  });
}

/**
 * Sprinkle ongoing/permanent events through the chronological feed
 * (one after every `ongoingInterleaveEvery` dated events) so they neither
 * dominate the top of the list nor disappear from it.
 */
export function interleaveOngoing(events: Event[]): Event[] {
  const every = rules.ongoingInterleaveEvery;
  const ongoing = events.filter(isOngoing);
  const dated = events.filter((e) => !isOngoing(e));
  if (ongoing.length === 0) return dated;
  const result: Event[] = [];
  let oi = 0;
  for (let i = 0; i < dated.length; i++) {
    result.push(dated[i]);
    if ((i + 1) % every === 0 && oi < ongoing.length) {
      result.push(ongoing[oi++]);
    }
  }
  while (oi < ongoing.length) result.push(ongoing[oi++]);
  return result;
}

/**
 * Whether an event is "active" at some point within [from, to] (inclusive,
 * YYYY-MM-DD). Events without an end date are treated as open-ended — they
 * have passed the staleness filter, so they are presumed still running.
 */
export function eventActiveInRange(event: Event, from: string, to: string): boolean {
  if (event.start_date > to) return false;
  return !event.end_date || event.end_date >= from;
}

export type Admission = { admit: true } | { admit: false; reason: string; isError?: boolean };

/**
 * Sync-time admission rules for scraped events (PLATFORM_SPEC §7.4).
 */
export function admitRawEvent(raw: RawEvent, today: string): Admission {
  if (matchesExclusions(raw.title, raw.description)) {
    return { admit: false, reason: 'matches audience exclusion pattern' };
  }
  if (raw.end_date && raw.end_date < today) {
    return { admit: false, reason: 'definitively past' };
  }
  // One-off past events are dropped; long-running types (exhibitions,
  // festivals) may legitimately have started before today.
  if (
    !raw.end_date &&
    !rules.pastStartAllowedTypes.includes(raw.event_type as Event['event_type']) &&
    raw.start_date < today
  ) {
    return { admit: false, reason: 'one-off event in the past' };
  }
  if (raw.end_date && raw.start_date && raw.end_date < raw.start_date) {
    return {
      admit: false,
      reason: `end_date ${raw.end_date} is before start_date ${raw.start_date}`,
      isError: true,
    };
  }
  return { admit: true };
}
