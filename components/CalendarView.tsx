'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Event, EVENT_TYPES } from '@/lib/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function eventActiveOn(event: Event, dateStr: string): boolean {
  if (event.end_date) return event.start_date <= dateStr && event.end_date >= dateStr;
  return event.start_date === dateStr;
}

export default function CalendarView({ events }: { events: Event[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDay(null); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null); };

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const filteredEvents = useMemo(
    () => typeFilter === 'all' ? events : events.filter(e => e.event_type === typeFilter),
    [events, typeFilter],
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = isoDate(year, month, d);
      map[ds] = filteredEvents.filter(e => eventActiveOn(e, ds));
    }
    return map;
  }, [filteredEvents, year, month, daysInMonth]);

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button onClick={goToday} style={{
            minHeight: '38px', padding: '0 var(--space-3)',
            background: 'white', border: '1px solid var(--colour-line)',
            borderRadius: '999px', fontSize: '.88rem', fontWeight: 700,
            color: 'var(--colour-ink)', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Today
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--colour-muted)' }}>
              <ChevronLeft size={20} />
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', minWidth: '200px', textAlign: 'center', color: 'var(--colour-ink)' }}>
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--colour-muted)' }}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTypeFilter('all')}
            style={{
              minHeight: '34px', padding: '0 var(--space-3)',
              background: typeFilter === 'all' ? 'var(--colour-primary)' : 'white',
              border: `1px solid ${typeFilter === 'all' ? 'var(--colour-primary)' : 'var(--colour-line)'}`,
              borderRadius: '999px', fontSize: '.82rem', fontWeight: 700,
              color: typeFilter === 'all' ? 'white' : 'var(--colour-ink)',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            All
          </button>
          {EVENT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(typeFilter === value ? 'all' : value)}
              style={{
                minHeight: '34px', padding: '0 var(--space-3)',
                background: typeFilter === value ? 'var(--colour-primary)' : 'white',
                border: `1px solid ${typeFilter === value ? 'var(--colour-primary)' : 'var(--colour-line)'}`,
                borderRadius: '999px', fontSize: '.82rem', fontWeight: 700,
                color: typeFilter === value ? 'white' : 'var(--colour-ink)',
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        overflow: 'hidden', background: 'var(--colour-surface)',
        border: '1px solid var(--colour-line)', borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Day headers */}
        {DAYS.map(d => (
          <div key={d} style={{
            padding: 'var(--space-2)', textAlign: 'center',
            fontSize: '.75rem', fontWeight: 700, letterSpacing: '.04em',
            textTransform: 'uppercase', color: 'var(--colour-muted)',
            borderBottom: '1px solid var(--colour-line)',
          }}>
            {d}
          </div>
        ))}

        {/* Empty cells */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} style={{
            minHeight: '132px', padding: 'var(--space-3)',
            borderRight: '1px solid var(--colour-line)',
            borderBottom: '1px solid var(--colour-line)',
            background: 'var(--colour-surface-soft)',
          }} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ds = isoDate(year, month, day);
          const dayEvents = eventsByDate[ds] ?? [];
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDay;

          return (
            <button
              key={ds}
              onClick={() => setSelectedDay(isSelected ? null : ds)}
              style={{
                minHeight: '132px', padding: 'var(--space-3)',
                borderRight: '1px solid var(--colour-line)',
                borderBottom: '1px solid var(--colour-line)',
                background: isSelected ? 'var(--colour-primary-soft)' : 'var(--colour-surface)',
                cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                textAlign: 'left', display: 'flex', flexDirection: 'column',
                gap: '4px', fontFamily: 'var(--font-body)',
                border: isSelected ? `1px solid var(--colour-primary)` : undefined,
              }}
            >
              <strong style={{
                display: 'inline-flex', width: '28px', height: '28px',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', fontSize: '.9rem',
                background: isToday ? 'var(--colour-primary)' : 'transparent',
                color: isToday ? 'white' : 'var(--colour-ink)',
                flexShrink: 0,
              }}>
                {day}
              </strong>
              {dayEvents.slice(0, 3).map(e => (
                <span key={e.id} style={{
                  fontSize: '.72rem', color: 'var(--colour-muted)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}>
                  {e.title}
                </span>
              ))}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: '.72rem', color: 'var(--colour-primary-dark)', fontWeight: 700 }}>
                  +{dayEvents.length - 3} more
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div style={{
          background: 'var(--colour-surface)', border: '1px solid var(--colour-line)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-5)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--colour-ink)' }}>
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--colour-muted)' }}>
              <X size={16} />
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p style={{ color: 'var(--colour-muted)', fontSize: '.9rem' }}>No events on this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {selectedEvents.map(e => (
                <Link key={e.id} href={`/events/${e.id}`} style={{
                  display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                  padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--colour-surface-soft)',
                }}>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--colour-ink)', margin: 0, fontSize: '.95rem' }}>{e.title}</p>
                    <p style={{ color: 'var(--colour-muted)', margin: '2px 0 0', fontSize: '.82rem' }}>
                      {e.institution}{e.start_time && ` · ${e.start_time.slice(0, 5)}`}{e.is_free && ' · Free'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
