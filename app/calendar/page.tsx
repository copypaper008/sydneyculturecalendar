import { getEvents } from '@/lib/supabase';
import CalendarView from '@/components/CalendarView';

export const revalidate = 3600;

export default async function CalendarPage() {
  const events = await getEvents();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sydney Culture Calendar</h1>
        <p className="text-gray-500 mt-1">
          Browse cultural events across Sydney — exhibitions, festivals, talks and more.
        </p>
      </div>
      <CalendarView events={events} />
    </div>
  );
}
