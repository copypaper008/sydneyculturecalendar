'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Event } from '@/lib/types';

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
  other: 'bg-gray-400',
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Returns true if event is active on the given date string */
function eventActiveOn(event: Event, dateStr: string): boolean {
  if (event.end_date) return event.start_date <= dateStr && event.end_date >= dateStr;
  return event.start_date === dateStr;
}

export default function CalendarView({ events }: { events: Event[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  const firstDow = new Date(year, month, 1).getDay(); // day of week for 1st
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map date string → events
  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = isoDate(year, month, d);
      map[ds] = events.filter((e) => eventActiveOn(e, ds));
    }
    return map;
  }, [events, year, month, daysInMonth]);

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLOURS).map(([type, colour]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-full ${colour}`} />
            {type.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {/* Leading empty cells */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-100 bg-gray-50/50" />
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
                className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 flex flex-col items-start text-left transition-colors ${
                  isSelected
                    ? 'bg-teal-50 border-teal-300'
                    : dayEvents.length > 0
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${
                    isToday
                      ? 'bg-teal-700 text-white'
                      : isSelected
                      ? 'bg-teal-200 text-teal-900'
                      : 'text-gray-700'
                  }`}
                >
                  {day}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 4).map((e) => (
                    <span
                      key={e.id}
                      className={`w-2 h-2 rounded-full ${TYPE_COLOURS[e.event_type] ?? 'bg-gray-400'}`}
                      title={e.title}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-xs text-gray-400 ml-0.5">+{dayEvents.length - 4}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="bg-white border border-teal-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No events on this day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-teal-50 transition-colors group"
                >
                  <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${TYPE_COLOURS[e.event_type] ?? 'bg-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-teal-700">
                      {e.title}
                    </p>
                    <p className="text-xs text-gray-500">
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
