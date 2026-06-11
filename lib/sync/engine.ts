import { createClient } from '@supabase/supabase-js'
import { RawEvent } from './types'
import { admitRawEvent } from '@/lib/events/rules'
import { todayISO } from '@/lib/format'

export interface SyncResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

export async function syncEvents(rawEvents: RawEvent[]): Promise<SyncResult> {
  const supabase = getSupabaseAdmin()
  const today = todayISO()

  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }

  for (const raw of rawEvents) {
    const admission = admitRawEvent(raw, today)
    if (!admission.admit) {
      if (admission.isError) result.errors.push(`Skipping ${raw.source_id}: ${admission.reason}`)
      result.skipped++
      continue
    }

    // Check if the event already exists
    const { data: existing, error: selectError } = await supabase
      .from('events')
      .select('id')
      .eq('source', raw.source)
      .eq('source_id', raw.source_id)
      .maybeSingle()

    if (selectError) {
      result.errors.push(`Select error for ${raw.source_id}: ${selectError.message}`)
      continue
    }

    const payload = {
      title: raw.title,
      institution: raw.institution,
      event_type: raw.event_type,
      start_date: raw.start_date,
      end_date: raw.end_date ?? null,
      start_time: raw.start_time ?? null,
      end_time: raw.end_time ?? null,
      venue: raw.venue ?? null,
      suburb: raw.suburb ?? null,
      description: raw.description ?? null,
      image_url: raw.image_url ?? null,
      event_url: raw.event_url,
      ticket_url: raw.ticket_url ?? null,
      is_free: raw.is_free,
      tags: raw.tags,
      source: raw.source,
      source_id: raw.source_id,
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('events')
        .update({
          title: payload.title,
          description: payload.description,
          event_type: payload.event_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          venue: payload.venue,
          image_url: payload.image_url,
          event_url: payload.event_url,
          ticket_url: payload.ticket_url,
          is_free: payload.is_free,
          tags: payload.tags,
        })
        .eq('id', existing.id)

      if (updateError) {
        result.errors.push(`Update error for ${raw.source_id}: ${updateError.message}`)
      } else {
        result.updated++
      }
    } else {
      const { error: insertError } = await supabase
        .from('events')
        .insert(payload)

      if (insertError) {
        result.errors.push(`Insert error for ${raw.source_id}: ${insertError.message}`)
      } else {
        result.inserted++
      }
    }
  }

  return result
}
