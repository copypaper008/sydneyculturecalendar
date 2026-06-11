import Link from 'next/link';
import { getEvents } from '@/lib/supabase';
import { siteConfig } from '@/config/site';
import { EVENT_TYPE_OPTIONS } from '@/lib/event-types';
import { eventActiveInRange } from '@/lib/events/rules';
import { addDaysISO, todayISO } from '@/lib/format';
import EventCard from '@/components/EventCard';

export const revalidate = 3600;

/** Upcoming Saturday and Sunday (today counts if it is one). */
function weekendRange(today: string): [string, string] {
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const sat = addDaysISO(today, (6 - dow) % 7);
  return [sat, addDaysISO(sat, 1)];
}

export default async function Home() {
  const events = await getEvents();
  const today = todayISO();
  const [sat, sun] = weekendRange(today);
  const { freeWindowDays, newExhibitionWindowDays } = siteConfig.discovery;

  const todayEvents = events.filter(e => eventActiveInRange(e, today, today));
  const weekendEvents = events.filter(e => eventActiveInRange(e, sat, sun));
  const freeEvents = events.filter(e =>
    e.is_free && eventActiveInRange(e, today, addDaysISO(today, freeWindowDays))
  );
  const newExhibitions = events.filter(e =>
    e.event_type === 'exhibition' &&
    e.start_date >= addDaysISO(today, -newExhibitionWindowDays) &&
    e.start_date <= addDaysISO(today, newExhibitionWindowDays)
  );

  const featured = events.slice(0, siteConfig.rules.featuredCount);

  return (
    <div>
      {/* Hero — full-bleed, break out of main's padding */}
      <div style={{
        minHeight: '420px',
        display: 'flex',
        alignItems: 'center',
        marginTop: 'var(--space-4)',
        marginInline: 'calc(var(--space-4) * -1)',
        padding: 'var(--space-6) max(var(--space-6), 5vw)',
        background: `linear-gradient(90deg, rgb(255 253 248 / 95%) 40%, rgb(255 253 248 / 20%)),
          url("${siteConfig.brand.hero.imageUrl}")`,
        backgroundPosition: 'center right',
        backgroundSize: 'cover',
        border: '1px solid var(--colour-line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-soft)',
      }}>
        <div style={{ maxWidth: '530px' }}>
          <p style={{ color: 'var(--colour-primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', margin: 0 }}>
            {siteConfig.brand.hero.eyebrow}
          </p>
          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 4.5rem)', fontFamily: 'var(--font-display)', letterSpacing: '-.03em', marginBlock: 'var(--space-3)', color: 'var(--colour-ink)' }}>
            {siteConfig.brand.hero.title}
          </h1>
          <p style={{ color: 'var(--colour-muted)', fontSize: '1.05rem', marginBottom: 'var(--space-4)' }}>
            {siteConfig.brand.hero.subtitle}
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
        <div className="discovery-grid">
          {[
            { label: `Today in ${siteConfig.city.name}`, count: todayEvents.length, href: '/events' },
            { label: 'This Weekend', count: weekendEvents.length, href: `/events?from=${sat}&to=${sun}` },
            { label: 'Free This Week', count: freeEvents.length, href: '/events?free=true' },
            { label: 'New Exhibitions', count: newExhibitions.length, href: '/events?type=exhibition' },
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
        <div className="cards-3">
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
        <div className="discovery-grid">
          {EVENT_TYPE_OPTIONS.map(({ value, label }) => {
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
