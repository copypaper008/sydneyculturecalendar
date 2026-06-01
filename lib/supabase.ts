import { createClient } from '@supabase/supabase-js';
import { Event } from './types';
import { seedEvents } from '@/data/seed';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function getEvents(): Promise<Event[]> {
  if (!supabase) return seedEvents;
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true });
  if (error || !data) return seedEvents;
  return data as Event[];
}

export async function getEventById(id: string): Promise<Event | null> {
  if (!supabase) return seedEvents.find((e) => e.id === id) ?? null;
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return seedEvents.find((e) => e.id === id) ?? null;
  return data as Event;
}
