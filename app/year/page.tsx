import { getEvents } from '@/lib/supabase';
import YearCalendar from '@/components/YearCalendar';

export const revalidate = 3600;

export default async function YearPage() {
  const events = await getEvents();
  return <YearCalendar events={events} />;
}
