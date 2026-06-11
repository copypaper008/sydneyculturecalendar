export type EventType =
  | 'exhibition'
  | 'festival'
  | 'talk'
  | 'performance'
  | 'open_day'
  | 'heritage'
  | 'other';

export interface Event {
  id: string;
  title: string;
  institution: string;
  event_type: EventType;
  start_date: string; // ISO date string YYYY-MM-DD
  end_date?: string;
  start_time?: string; // HH:MM
  end_time?: string;
  venue?: string;
  suburb?: string;
  description?: string;
  image_url?: string;
  event_url?: string;
  ticket_url?: string;
  is_free: boolean;
  tags?: string[];
  source?: string;
  source_id?: string;
  created_at?: string;
}

/** Canonical taxonomy order — matches the event_type DB enum. */
export const EVENT_TYPE_VALUES: EventType[] = [
  'exhibition',
  'festival',
  'talk',
  'performance',
  'open_day',
  'heritage',
  'other',
];
