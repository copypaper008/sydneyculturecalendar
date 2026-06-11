'use client';

import Link from 'next/link';
import { Event } from '@/lib/types';
import { formatDateRangeShort } from '@/lib/format';
import { isOngoing } from '@/lib/events/rules';
import { eventTypeLabel } from '@/lib/event-types';

export default function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.id}`} style={{ display: 'block', height: '100%' }}>
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--colour-surface)',
        border: '1px solid var(--colour-line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--colour-primary)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--colour-line)'; }}
      >
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: '#e8e3da' }}>
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e8e3da, #d5cfc4)' }} />
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
          {/* Tag row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{
              fontSize: '.72rem', fontWeight: 800, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--colour-accent)',
            }}>
              {eventTypeLabel(event.event_type)}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
              {event.source && event.source !== 'manual' && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', minHeight: '24px',
                  padding: '0 var(--space-2)', borderRadius: '999px',
                  background: '#e8f4fd', border: '1px solid #b3d7f0',
                  fontSize: '.72rem', fontWeight: 750, textTransform: 'uppercase',
                  color: '#1a6a9a',
                }}>
                  Feed
                </span>
              )}
              {(!event.source || event.source === 'manual') && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', minHeight: '24px',
                  padding: '0 var(--space-2)', borderRadius: '999px',
                  background: '#fde8f0', border: '1px solid #f0b3cd',
                  fontSize: '.72rem', fontWeight: 750, textTransform: 'uppercase',
                  color: '#9a1a55',
                }}>
                  Sample
                </span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', minHeight: '24px',
                padding: '0 var(--space-2)', borderRadius: '999px',
                background: event.is_free ? 'var(--colour-free)' : 'var(--colour-ticketed)',
                border: event.is_free ? 'none' : '1px solid var(--colour-line)',
                fontSize: '.72rem', fontWeight: 750, textTransform: 'uppercase',
                color: 'var(--colour-ink)',
              }}>
                {event.is_free ? 'Free' : 'Ticketed'}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.08rem',
            fontWeight: 700,
            color: 'var(--colour-ink)',
            lineHeight: 1.2,
            letterSpacing: '-.02em',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {event.title}
          </h3>

          {/* Metadata — no icons, plain text */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
            <span style={{ fontSize: '.85rem', color: 'var(--colour-muted)' }}>{event.institution}</span>
            <span style={{ fontSize: '.85rem', color: 'var(--colour-muted)' }}>
              {isOngoing(event) ? 'Ongoing' : formatDateRangeShort(event.start_date, event.end_date)}
              {event.suburb && ` · ${event.suburb}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
