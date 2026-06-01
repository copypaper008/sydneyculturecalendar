import { getEvents } from '@/lib/supabase';
import EventList from '@/components/EventList';

export const revalidate = 3600;

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-stone-900"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          All Events
        </h1>
        <p className="text-stone-500 mt-1.5">
          Search and filter Sydney&apos;s cultural events.
        </p>
      </div>
      <EventList events={events} />
    </div>
  );
}
