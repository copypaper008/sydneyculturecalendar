import { siteConfig } from '@/config/site';

const { locale, timeZone } = siteConfig.city;

/**
 * Today's date in the configured city timezone, as YYYY-MM-DD.
 * Server and client both resolve the city's calendar date, not the
 * machine's — important for a city-scoped "what's on today".
 */
export function todayISO(): string {
  // en-CA reliably formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** Add (or subtract) days to a YYYY-MM-DD string. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Subtract months from a YYYY-MM-DD string. */
export function monthsAgoISO(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function toDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return toDate(iso).toLocaleDateString(locale, opts);
}

/** "5 Jun" or "5 Jun – 30 Aug 2026" — card-sized. */
export function formatDateRangeShort(start: string, end?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!end || end === start) return formatDate(start, opts);
  return `${formatDate(start, opts)} – ${formatDate(end, { ...opts, year: 'numeric' })}`;
}

/** "5 June 2026" or "5 June – 30 August 2026" — detail-sized. */
export function formatDateRangeLong(start: string, end?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  if (!end || end === start) return formatDate(start, opts);
  return `${formatDate(start, { day: 'numeric', month: 'long' })} – ${formatDate(end, opts)}`;
}

/** "18:30" → "6:30pm" */
export function formatTime12h(t?: string): string | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`;
}

/** Localised month names for the configured locale ('long' or 'short'). */
export function monthNames(style: 'long' | 'short' = 'long'): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(Date.UTC(2024, m, 1))));
}

/** Localised weekday names, Sunday-first, for the configured locale. */
export function weekdayNames(style: 'long' | 'short' = 'short'): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' });
  // 2024-09-01 is a Sunday
  return Array.from({ length: 7 }, (_, d) => fmt.format(new Date(Date.UTC(2024, 8, 1 + d))));
}
