import { notFound } from 'next/navigation';
import { getEventById, getEvents } from '@/lib/supabase';
import EventDetail from '@/components/EventDetail';

export const revalidate = 3600;

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return { title: 'Event not found' };
  return {
    title: `${event.title} — Sydney Culture Calendar`,
    description: event.description ?? `${event.title} at ${event.institution}`,
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, allEvents] = await Promise.all([getEventById(id), getEvents()]);
  if (!event) notFound();

  const related = allEvents
    .filter((e) => e.id !== event.id && e.event_type === event.event_type)
    .slice(0, 3);

  return <EventDetail event={event} relatedEvents={related} />;
}
