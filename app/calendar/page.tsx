import { getEvents } from '@/lib/supabase';
import CalendarView from '@/components/CalendarView';

export const revalidate = 3600;

export default async function CalendarPage() {
  const events = await getEvents();

  return (
    <div style={{ paddingTop: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--colour-ink)' }}>
          Sydney Culture Calendar
        </h1>
        <p style={{ color: 'var(--colour-muted)', marginTop: 'var(--space-2)', fontSize: '1rem' }}>
          Browse cultural events across Sydney — exhibitions, festivals, talks and more.
        </p>
      </div>
      <CalendarView events={events} />
    </div>
  );
}
