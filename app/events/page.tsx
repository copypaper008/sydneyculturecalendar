import { Suspense } from 'react';
import { getEvents } from '@/lib/supabase';
import EventList from '@/components/EventList';

export const revalidate = 3600;

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div style={{ paddingTop: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--colour-ink)' }}>
          All Events
        </h1>
        <p style={{ color: 'var(--colour-muted)', marginTop: 'var(--space-2)', fontSize: '1rem' }}>
          Search and filter cultural events.
        </p>
      </div>
      {/* Suspense boundary required: EventList reads the URL via useSearchParams
          on a statically rendered page */}
      <Suspense>
        <EventList events={events} />
      </Suspense>
    </div>
  );
}
