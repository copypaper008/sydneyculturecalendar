import { createClient } from '@supabase/supabase-js';
import { Event } from './types';
import { seedEvents } from '@/data/seed';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function interleaveOngoing(events: Event[]): Event[] {
  const ongoing = events.filter(e => Array.isArray(e.tags) && e.tags.includes('ongoing'))
  const dated = events.filter(e => !Array.isArray(e.tags) || !e.tags.includes('ongoing'))
  if (ongoing.length === 0) return dated
  const result: Event[] = []
  let oi = 0
  for (let i = 0; i < dated.length; i++) {
    result.push(dated[i])
    // Insert an ongoing event every 3 dated events
    if ((i + 1) % 3 === 0 && oi < ongoing.length) {
      result.push(ongoing[oi++])
    }
  }
  // Append any remaining ongoing events
  while (oi < ongoing.length) result.push(ongoing[oi++])
  return result
}

const SCHOOL_RE = /\bschool\b/i

function filterEvents(events: Event[]): Event[] {
  return events.filter(e => !SCHOOL_RE.test(e.title) && !SCHOOL_RE.test(e.description ?? ''))
}

export async function getEvents(): Promise<Event[]> {
  if (!supabase) return filterEvents(seedEvents);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true });
  if (error || !data) return filterEvents(seedEvents);
  return interleaveOngoing(filterEvents(data as Event[]));
}

export async function getEventById(id: string): Promise<Event | null> {
  if (!supabase) {
    const e = seedEvents.find((e) => e.id === id) ?? null;
    return e && !SCHOOL_RE.test(e.title) && !SCHOOL_RE.test(e.description ?? '') ? e : null;
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const e = data as Event;
  if (SCHOOL_RE.test(e.title) || SCHOOL_RE.test(e.description ?? '')) return null;
  return e;
}
