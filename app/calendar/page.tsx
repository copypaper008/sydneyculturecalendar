import { getEvents } from '@/lib/supabase';
import CalendarView from '@/components/CalendarView';

export const revalidate = 3600;

export default async function CalendarPage() {
  const events = await getEvents();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-stone-900"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Sydney Culture Calendar
        </h1>
        <p className="text-stone-500 mt-1.5">
          Browse cultural events across Sydney — exhibitions, festivals, talks and more.
        </p>
      </div>
      <CalendarView events={events} />
    </div>
  );
}
