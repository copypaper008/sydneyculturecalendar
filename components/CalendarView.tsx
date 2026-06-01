'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Event, EVENT_TYPES } from '@/lib/types';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TYPE_COLOURS: Record<string, string> = {
  exhibition: 'bg-violet-500',
  festival: 'bg-orange-500',
  talk: 'bg-sky-500',
  performance: 'bg-pink-500',
  open_day: 'bg-green-500',
  heritage: 'bg-amber-500',
  other: 'bg-stone-400',
};

const TYPE_CHIP_COLOURS: Record<string, string> = {
  exhibition: 'bg-violet-100 text-violet-800 border-violet-200',
  festival: 'bg-orange-100 text-orange-800 border-orange-200',
  talk: 'bg-sky-100 text-sky-800 border-sky-200',
  performance: 'bg-pink-100 text-pink-800 border-pink-200',
  open_day: 'bg-green-100 text-green-800 border-green-200',
  heritage: 'bg-amber-100 text-amber-800 border-amber-200',
  other: 'bg-stone-100 text-stone-700 border-stone-200',
};

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

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(null);
  };

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const filteredEvents = useMemo(
    () => (typeFilter === 'all' ? events : events.filter((e) => e.event_type === typeFilter)),
    [events, typeFilter],
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = isoDate(year, month, d);
      map[ds] = filteredEvents.filter((e) => eventActiveOn(e, ds));
    }
    return map;
  }, [filteredEvents, year, month, daysInMonth]);

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Month navigation + Today button */}
      <div className="flex items-center gap-3">
        <button
          onClick={goToday}
          className="px-3.5 py-1.5 rounded-full text-sm font-medium border border-stone-200 bg-white text-stone-700 hover:border-teal-400 transition-all"
        >
          Today
        </button>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </button>
          <h2
            className="text-xl font-bold text-stone-900 min-w-[160px] text-center"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-stone-600" />
          </button>
        </div>
      </div>

      {/* Event type filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
            typeFilter === 'all'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
          }`}
        >
          All types
        </button>
        {EVENT_TYPES.map(({ value, label }) => {
          const active = typeFilter === value;
          return (
            <button
              key={value}
              onClick={() => setTypeFilter(active ? 'all' : value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                active ? 'bg-teal-600 text-white border-teal-600' : `${TYPE_CHIP_COLOURS[value]} hover:opacity-80`
              }`}
            >
              {!active && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLOURS[value]}`} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-stone-200">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[88px] border-b border-r border-stone-100 bg-stone-50/50" />
          ))}

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
                className={`min-h-[88px] border-b border-r border-stone-100 p-2 flex flex-col items-start text-left transition-colors ${
                  isSelected
                    ? 'bg-teal-50'
                    : dayEvents.length > 0
                    ? 'hover:bg-stone-50 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${
                    isToday
                      ? 'bg-teal-600 text-white'
                      : isSelected
                      ? 'bg-teal-100 text-teal-900'
                      : 'text-stone-700'
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-xs font-semibold text-teal-700">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="bg-white border border-teal-200 rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-stone-100 rounded">
              <X className="w-4 h-4 text-stone-500" />
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-stone-500 text-sm">No events on this day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-teal-50 transition-colors group"
                >
                  <span className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${TYPE_COLOURS[e.event_type] ?? 'bg-stone-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-stone-900 group-hover:text-teal-700">
                      {e.title}
                    </p>
                    <p className="text-xs text-stone-500">
                      {e.institution}
                      {e.start_time && ` · ${e.start_time.slice(0,5)}`}
                      {e.is_free && ' · Free'}
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
