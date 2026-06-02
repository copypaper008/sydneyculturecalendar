import Link from 'next/link';
import { ArrowLeft, ExternalLink, Ticket, CalendarDays } from 'lucide-react';
import { Event } from '@/lib/types';
import EventCard from './EventCard';

function formatDateRange(start: string, end?: string): string {
  const startDate = new Date(start + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  if (!end || end === start) return startDate.toLocaleDateString('en-AU', opts);
  const endDate = new Date(end + 'T00:00:00');
  return `${startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })} – ${endDate.toLocaleDateString('en-AU', opts)}`;
}

function formatTime(t?: string): string | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`;
}

// ─── Mini calendar ───────────────────────────────────────────────────────────

const CAL_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthSpan(startISO: string, endISO: string): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let y = parseInt(startISO.slice(0, 4), 10);
  let m = parseInt(startISO.slice(5, 7), 10) - 1;
  const endY = parseInt(endISO.slice(0, 4), 10);
  const endM = parseInt(endISO.slice(5, 7), 10) - 1;
  while (y < endY || (y === endY && m <= endM)) {
    result.push({ year: y, month: m });
    if (++m > 11) { m = 0; y++; }
  }
  return result;
}

function MonthGrid({ year, month, startISO, endISO, todayISO }: {
  year: number; month: number; startISO: string; endISO: string; todayISO: string;
}) {
  const firstDOW = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDOW).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ width: '224px', flexShrink: 0 }}>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '.85rem', margin: '0 0 10px', color: 'var(--colour-ink)' }}>
        {CAL_MONTHS[month]} {year}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', rowGap: '2px' }}>
        {CAL_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '.65rem', fontWeight: 700, color: 'var(--colour-muted)', padding: '2px 0', letterSpacing: '.05em' }}>
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`b${idx}`} style={{ height: '32px' }} />;
          const mm = String(month + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const iso = `${year}-${mm}-${dd}`;
          const inRange = iso >= startISO && iso <= endISO;
          const isEndpoint = iso === startISO || iso === endISO;
          const isToday = iso === todayISO;
          return (
            <div key={`d${idx}`} style={{
              height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: inRange && !isEndpoint ? 'var(--colour-primary-soft)' : 'transparent',
            }}>
              <div style={{
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: isEndpoint ? 'var(--colour-primary)' : 'transparent',
                color: isEndpoint ? 'white' : inRange ? 'var(--colour-primary-dark)' : 'var(--colour-ink)',
                fontSize: '.8rem',
                fontWeight: inRange ? 600 : 400,
                outline: isToday && !isEndpoint ? '2px solid var(--colour-primary)' : undefined,
                outlineOffset: '2px',
              }}>
                {day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventDateCalendar({ event }: { event: Event }) {
  const isOngoing = Array.isArray(event.tags) && event.tags.includes('ongoing');
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const endISO = event.end_date || event.start_date;

  if (isOngoing) {
    return (
      <section style={{ marginTop: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 'var(--space-4)', color: 'var(--colour-ink)' }}>
          When
        </h2>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          background: 'var(--colour-primary-soft)',
          border: '1px solid var(--colour-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-5)',
        }}>
          <div style={{
            flexShrink: 0, width: '48px', height: '48px',
            background: 'var(--colour-primary)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarDays size={22} color="white" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--colour-primary-dark)', letterSpacing: '-.01em' }}>
              Ongoing
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '.88rem', color: 'var(--colour-muted)', lineHeight: 1.5 }}>
              This event runs continuously — visit anytime and check the official website for current opening hours.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const months = getMonthSpan(event.start_date, endISO);
  const MAX = 3;
  const truncated = months.length > MAX;
  const displayMonths = truncated
    ? [months[0], months[months.length - 1]]
    : months;

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 'var(--space-4)', color: 'var(--colour-ink)' }}>
        When
      </h2>
      <div style={{
        background: 'var(--colour-surface)', border: '1px solid var(--colour-line)',
        borderRadius: 'var(--radius-md)', padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          {displayMonths.map(({ year, month }, idx) => (
            <div key={`${year}-${month}`} style={{ display: 'contents' }}>
              {truncated && idx === 1 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--colour-muted)', gap: '4px', paddingTop: '28px',
                  fontSize: '.75rem', fontWeight: 600, letterSpacing: '.03em',
                }}>
                  <span>·</span><span>·</span><span>·</span>
                  <span style={{ fontSize: '.7rem', whiteSpace: 'nowrap' }}>{months.length} months</span>
                </div>
              )}
              <MonthGrid year={year} month={month} startISO={event.start_date} endISO={endISO} todayISO={todayISO} />
            </div>
          ))}
        </div>
        {months.length > 1 && (
          <p style={{ margin: 'var(--space-4) 0 0', fontSize: '.78rem', color: 'var(--colour-muted)', borderTop: '1px solid var(--colour-line)', paddingTop: 'var(--space-3)' }}>
            {formatDateRange(event.start_date, event.end_date)}
          </p>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EventDetail({ event, relatedEvents }: { event: Event; relatedEvents?: Event[] }) {
  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);

  const meta = [
    { label: 'Institution', value: event.institution },
    { label: 'Dates', value: formatDateRange(event.start_date, event.end_date) },
    startTime ? { label: 'Time', value: endTime ? `${startTime} – ${endTime}` : startTime } : null,
    event.venue ? { label: 'Venue', value: event.venue } : null,
    event.suburb ? { label: 'Suburb', value: event.suburb } : null,
    { label: 'Cost', value: event.is_free ? 'Free admission' : 'Ticketed' },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article>
      <Link href="/events" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '.88rem', color: 'var(--colour-primary-dark)',
        fontWeight: 600, marginBottom: 'var(--space-5)',
      }}>
        <ArrowLeft size={16} /> Back to events
      </Link>

      {/* Full-width hero image */}
      <div style={{
        width: '100%', aspectRatio: '21/9', overflow: 'hidden',
        borderRadius: 'var(--radius-lg)', background: '#e8e3da',
        marginBottom: 'var(--space-5)',
      }}>
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e8e3da, #c9c2b5)' }} />
        )}
      </div>

      {/* Two-column: left = info, right = metadata */}
      <div className="detail-grid">

        {/* Left */}
        <div>
          <p style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--colour-accent)', margin: '0 0 var(--space-3)' }}>
            {event.event_type.replace('_', ' ')}
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3rem)',
            color: 'var(--colour-ink)', letterSpacing: '-.03em', marginBottom: 'var(--space-4)',
          }}>
            {event.title}
          </h1>

          {event.description && (
            <>
              <h3 style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--colour-muted)', marginBottom: 'var(--space-3)' }}>
                About
              </h3>
              <p style={{ color: 'var(--colour-muted)', lineHeight: 1.7, fontSize: '1rem', marginBottom: 'var(--space-5)' }}>
                {event.description}
              </p>
            </>
          )}

          {event.tags && event.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              {event.tags.map(tag => (
                <span key={tag} style={{
                  padding: '4px 12px', background: 'var(--colour-surface)',
                  border: '1px solid var(--colour-line)', borderRadius: '999px',
                  fontSize: '.78rem', color: 'var(--colour-muted)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: metadata + actions */}
        <div style={{
          background: 'var(--colour-surface)', border: '1px solid var(--colour-line)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-5)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {meta.map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--colour-line)' }}>
                  <td style={{ padding: 'var(--space-3) 0', fontSize: '.78rem', fontWeight: 700, color: 'var(--colour-muted)', textTransform: 'uppercase', letterSpacing: '.04em', paddingRight: 'var(--space-3)', whiteSpace: 'nowrap' }}>
                    {label}
                  </td>
                  <td style={{ padding: 'var(--space-3) 0', fontSize: '.9rem', color: 'var(--colour-ink)', fontWeight: 500 }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            {event.event_url && (
              <a href={event.event_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                minHeight: '44px', padding: '0 var(--space-4)',
                background: 'var(--colour-primary)', color: 'white',
                borderRadius: 'var(--radius-sm)', fontWeight: 750, fontSize: '.9rem',
              }}>
                <ExternalLink size={15} /> Official website
              </a>
            )}
            {event.ticket_url && (
              <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                minHeight: '44px', padding: '0 var(--space-4)',
                background: 'white', color: 'var(--colour-primary-dark)',
                border: '1px solid var(--colour-line)',
                borderRadius: 'var(--radius-sm)', fontWeight: 750, fontSize: '.9rem',
              }}>
                <Ticket size={15} /> Get tickets
              </a>
            )}
          </div>
        </div>
      </div>

      <EventDateCalendar event={event} />

      {/* Related events */}
      {relatedEvents && relatedEvents.length > 0 && (
        <section style={{ marginTop: 'var(--space-7)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 'var(--space-4)', color: 'var(--colour-ink)' }}>
            You may also like
          </h2>
          <div className="cards-3">
            {relatedEvents.slice(0, 3).map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
