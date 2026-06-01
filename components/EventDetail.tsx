import Link from 'next/link';
import { ArrowLeft, ExternalLink, Ticket } from 'lucide-react';
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
