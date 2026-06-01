import Link from 'next/link';
import { getEvents } from '@/lib/supabase';
import { EVENT_TYPES } from '@/lib/types';
import EventCard from '@/components/EventCard';

export const revalidate = 3600;

export default async function Home() {
  const events = await getEvents();
  const today = new Date().toISOString().split('T')[0];

  const weekend = (() => {
    const d = new Date();
    const day = d.getDay();
    const sat = new Date(d); sat.setDate(d.getDate() + (6 - day));
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return [sat.toISOString().split('T')[0], sun.toISOString().split('T')[0]];
  })();

  const todayEvents = events.filter(e =>
    e.start_date <= today && (!e.end_date || e.end_date >= today)
  );
  const weekendEvents = events.filter(e =>
    weekend.some(d => e.start_date <= d && (!e.end_date || e.end_date >= d))
  );
  const freeEvents = events.filter(e => e.is_free);
  const exhibitions = events.filter(e => e.event_type === 'exhibition');

  const featured = events.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <div style={{
        minHeight: '420px',
        display: 'flex',
        alignItems: 'center',
        marginTop: 'var(--space-4)',
        padding: 'var(--space-6)',
        background: `linear-gradient(90deg, rgb(255 253 248 / 96%), rgb(255 253 248 / 45%)),
          url("https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1800&q=80")`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        border: '1px solid var(--colour-line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-soft)',
      }}>
        <div style={{ maxWidth: '530px' }}>
          <p style={{ color: 'var(--colour-accent)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', margin: 0 }}>
            Sydney, Australia
          </p>
          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 4.5rem)', fontFamily: 'var(--font-display)', letterSpacing: '-.03em', marginBlock: 'var(--space-3)', color: 'var(--colour-ink)' }}>
            Discover what&apos;s on in Sydney
          </h1>
          <p style={{ color: 'var(--colour-muted)', fontSize: '1.05rem', marginBottom: 'var(--space-4)' }}>
            Exhibitions, festivals, talks and performances — all in one place.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Link href="/events" style={{
              display: 'inline-flex', alignItems: 'center', minHeight: '44px',
              padding: '0 var(--space-4)', borderRadius: 'var(--radius-sm)',
              background: 'var(--colour-primary)', color: 'white', fontWeight: 750,
            }}>
              Explore events
            </Link>
            <Link href="/calendar" style={{
              display: 'inline-flex', alignItems: 'center', minHeight: '44px',
              padding: '0 var(--space-4)', borderRadius: 'var(--radius-sm)',
              background: 'white', color: 'var(--colour-primary-dark)', fontWeight: 750,
              border: '1px solid var(--colour-line)',
            }}>
              View calendar
            </Link>
          </div>
        </div>
      </div>

      {/* Discovery quick-links */}
      <div style={{ marginTop: 'var(--space-7)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          {[
            { label: 'Today in Sydney', count: todayEvents.length, href: '/events' },
            { label: 'This Weekend', count: weekendEvents.length, href: '/events' },
            { label: 'Free This Week', count: freeEvents.length, href: '/events?free=true' },
            { label: 'New Exhibitions', count: exhibitions.length, href: '/events?type=exhibition' },
          ].map(({ label, count, href }) => (
            <Link key={label} href={href} style={{
              padding: 'var(--space-4)',
              background: 'var(--colour-surface)',
              border: '1px solid var(--colour-line)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
              display: 'block',
            }}>
              <div style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-.03em', color: 'var(--colour-primary-dark)', lineHeight: 1 }}>
                {count}
              </div>
              <div style={{ marginTop: 'var(--space-2)', color: 'var(--colour-muted)', fontSize: '.9rem', fontWeight: 500 }}>
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured events */}
      <section style={{ marginTop: 'var(--space-7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontFamily: 'var(--font-display)' }}>
              Featured Events
            </h2>
            <p style={{ color: 'var(--colour-muted)', marginTop: 'var(--space-1)' }}>
              Highlights from across the city
            </p>
          </div>
          <Link href="/events" style={{ color: 'var(--colour-primary-dark)', fontSize: '.9rem', fontWeight: 600 }}>
            View all →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {featured.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* By type */}
      <section style={{ marginTop: 'var(--space-7)' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)' }}>
          Browse by type
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
          {EVENT_TYPES.map(({ value, label }) => {
            const count = events.filter(e => e.event_type === value).length;
            if (!count) return null;
            return (
              <Link key={value} href={`/events?type=${value}`} style={{
                padding: 'var(--space-4)',
                background: 'var(--colour-surface)',
                border: '1px solid var(--colour-line)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
              }}>
                <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--colour-primary-dark)', lineHeight: 1 }}>
                  {count}
                </div>
                <div style={{ marginTop: 'var(--space-2)', fontSize: '.88rem', fontWeight: 600, color: 'var(--colour-ink)', textTransform: 'capitalize' }}>
                  {label}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
