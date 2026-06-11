import { createClient } from '@supabase/supabase-js';
import { Event } from './types';
import { seedEvents } from '@/data/seed';
import { displayFilter, interleaveOngoing, matchesExclusions } from '@/lib/events/rules';
import { todayISO } from '@/lib/format';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function getEvents(): Promise<Event[]> {
  if (!supabase) return interleaveOngoing(displayFilter(seedEvents));
  const today = todayISO();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: true });
  if (error || !data) return interleaveOngoing(displayFilter(seedEvents));
  return interleaveOngoing(displayFilter(data as Event[]));
}

export async function getEventById(id: string): Promise<Event | null> {
  if (!supabase) {
    const e = seedEvents.find((e) => e.id === id) ?? null;
    return e && !matchesExclusions(e.title, e.description) ? e : null;
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const e = data as Event;
  if (matchesExclusions(e.title, e.description)) return null;
  return e;
}
