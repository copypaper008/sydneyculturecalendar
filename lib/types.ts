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

export interface Institution {
  name: string;
  suburb: string;
  website: string;
}

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'festival', label: 'Festival' },
  { value: 'talk', label: 'Talk' },
  { value: 'performance', label: 'Performance' },
  { value: 'open_day', label: 'Open Day' },
  { value: 'heritage', label: 'Heritage' },
  { value: 'other', label: 'Other' },
];

export const INSTITUTIONS = [
  'Art Gallery of NSW',
  'Museum of Contemporary Art',
  'Powerhouse Museum',
  'Australian National Maritime Museum',
  'State Library of NSW',
  'White Rabbit Gallery',
  'Sydney Living Museums',
  'Sydney Festival',
  'Vivid Sydney',
  'Sydney Writers\' Festival',
  'Biennale of Sydney',
  'City of Sydney',
  'Inner West Council',
];
