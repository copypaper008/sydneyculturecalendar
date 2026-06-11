import Link from 'next/link';
import { ArrowLeft, ExternalLink, Ticket, CalendarDays } from 'lucide-react';
import { Event } from '@/lib/types';
import { toInstitutionSlug } from '@/lib/utils';
import { formatDate, formatDateRangeLong, formatTime12h, monthNames, todayISO } from '@/lib/format';
import { isOngoing } from '@/lib/events/rules';
import { eventTypeColour, eventTypeLabel } from '@/lib/event-types';
import EventCard from './EventCard';

// ─── Event Gantt bar ─────────────────────────────────────────────────────────

const MON_LABELS = monthNames('short');

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function ganttMonths(startISO: string, endISO: string) {
  const months: { year: number; month: number; days: number; label: string }[] = [];
  let y = parseInt(startISO.slice(0, 4), 10);
  let m = parseInt(startISO.slice(5, 7), 10) - 1;
  const endY = parseInt(endISO.slice(0, 4), 10);
  const endM = parseInt(endISO.slice(5, 7), 10) - 1;
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m, days: daysInMonth(y, m), label: MON_LABELS[m] });
    if (++m > 11) { m = 0; y++; }
  }
  return months;
}

function dayIndex(iso: string): number {
  return Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 86400000);
}

function EventGantt({ event }: { event: Event }) {
  if (isOngoing(event)) {
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

  const endISO = event.end_date || event.start_date;
  const months = ganttMonths(event.start_date, endISO);
  const totalDays = months.reduce((sum, m) => sum + m.days, 0);
  const color = eventTypeColour(event.event_type);

  const today = todayISO();

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const ganttStart = `${firstMonth.year}-${String(firstMonth.month + 1).padStart(2, '0')}-01`;
  const ganttEnd = `${lastMonth.year}-${String(lastMonth.month + 1).padStart(2, '0')}-${String(lastMonth.days).padStart(2, '0')}`;
  const ganttStartDay = dayIndex(ganttStart);
  const ganttSpan = dayIndex(ganttEnd) - ganttStartDay + 1;

  const barLeft = ((dayIndex(event.start_date) - ganttStartDay) / ganttSpan) * 100;
  const barRight = ((dayIndex(endISO) - ganttStartDay + 1) / ganttSpan) * 100;
  const barWidth = Math.max(barRight - barLeft, 0.5);

  const todayInRange = today >= ganttStart && today <= ganttEnd;
  const todayPct = todayInRange ? ((dayIndex(today) - ganttStartDay) / ganttSpan) * 100 : null;

  const isSingleDay = event.start_date === endISO;

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
        {/* Month headers */}
        <div style={{ display: 'flex', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--colour-line)' }}>
          {months.map(({ year, month, days, label }) => (
            <div
              key={`${year}-${month}`}
              style={{
                flexBasis: `${(days / totalDays) * 100}%`, flexShrink: 0,
                fontSize: '.72rem', fontWeight: 700,
                color: 'var(--colour-muted)', letterSpacing: '.04em', textTransform: 'uppercase',
                paddingLeft: '4px',
              }}
            >
              {label}{months.length <= 4 ? ` ${year}` : ''}
            </div>
          ))}
        </div>

        {/* Track + bar */}
        <div style={{ position: 'relative', height: '54px', marginBottom: '10px' }}>
          {/* Grey track */}
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: 0, right: 0, height: '4px',
            background: '#e5e0d8', borderRadius: '2px',
          }} />
          {/* Event bar — styled like Year calendar */}
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: `${barLeft}%`, width: `${barWidth}%`,
            height: '44px',
            background: `${color}1f`,
            border: `1.5px solid ${color}`,
            borderRadius: '6px',
            minWidth: '6px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 10px',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}>
            <p style={{ margin: 0, fontSize: '.78rem', fontWeight: 700, color, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {event.title}
            </p>
            {!isSingleDay && (
              <p style={{ margin: '2px 0 0', fontSize: '.67rem', color: 'var(--colour-muted)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatDate(event.start_date, { day: 'numeric', month: 'short' })}
                {' – '}
                {formatDate(endISO, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          {/* Today line */}
          {todayPct !== null && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${todayPct}%`, width: '2px',
              background: '#ef4444', zIndex: 2,
              borderRadius: '1px',
            }}>
              <div style={{
                position: 'absolute', top: '-2px', left: '50%', transform: 'translateX(-50%)',
                width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444',
                boxShadow: '0 0 0 2px white',
              }} />
            </div>
          )}
        </div>

        {/* Date labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '.78rem', color: 'var(--colour-muted)', fontWeight: 600 }}>
            {formatDate(event.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {!isSingleDay && (
            <span style={{ fontSize: '.78rem', color: 'var(--colour-muted)', fontWeight: 600 }}>
              {formatDate(endISO, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EventDetail({ event, relatedEvents }: { event: Event; relatedEvents?: Event[] }) {
  const startTime = formatTime12h(event.start_time);
  const endTime = formatTime12h(event.end_time);
  const ongoing = isOngoing(event);

  const meta = [
    { label: 'Institution', value: event.institution, href: `/institutions/${toInstitutionSlug(event.institution)}` },
    { label: 'Dates', value: ongoing ? 'Permanent exhibition' : formatDateRangeLong(event.start_date, event.end_date) },
    startTime ? { label: 'Time', value: endTime ? `${startTime} – ${endTime}` : startTime } : null,
    event.venue ? { label: 'Venue', value: event.venue } : null,
    event.suburb ? { label: 'Suburb', value: event.suburb } : null,
    { label: 'Cost', value: event.is_free ? 'Free admission' : 'Ticketed' },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

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
            {eventTypeLabel(event.event_type)}
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
              {meta.map(({ label, value, href }) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--colour-line)' }}>
                  <td style={{ padding: 'var(--space-3) 0', fontSize: '.78rem', fontWeight: 700, color: 'var(--colour-muted)', textTransform: 'uppercase', letterSpacing: '.04em', paddingRight: 'var(--space-3)', whiteSpace: 'nowrap' }}>
                    {label}
                  </td>
                  <td style={{ padding: 'var(--space-3) 0', fontSize: '.9rem', color: 'var(--colour-ink)', fontWeight: 500 }}>
                    {href ? (
                      <Link href={href} style={{ color: 'var(--colour-primary-dark)', fontWeight: 600 }}>{value}</Link>
                    ) : value}
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

      <EventGantt event={event} />

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
