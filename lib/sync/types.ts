export interface RawEvent {
  title: string
  institution: string
  event_type: string
  start_date: string   // YYYY-MM-DD
  end_date?: string
  start_time?: string  // HH:MM
  end_time?: string
  venue?: string
  suburb?: string
  description?: string
  image_url?: string
  event_url: string
  ticket_url?: string
  is_free: boolean
  tags: string[]
  source: string       // e.g. 'slnsw-rss'
  source_id: string    // unique ID within source for dedup
}
