import Link from 'next/link';
import { Calendar, MapPin, Building2 } from 'lucide-react';
import { Event } from '@/lib/types';

function formatDateRange(start: string, end?: string): string {
  const startDate = new Date(start + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!end || end === start) return startDate.toLocaleDateString('en-AU', opts);
  const endDate = new Date(end + 'T00:00:00');
  return `${startDate.toLocaleDateString('en-AU', opts)} – ${endDate.toLocaleDateString('en-AU', { ...opts, year: 'numeric' })}`;
}

const TYPE_COLOURS: Record<string, string> = {
  exhibition: 'bg-violet-100 text-violet-800',
  festival: 'bg-orange-100 text-orange-800',
  talk: 'bg-sky-100 text-sky-800',
  performance: 'bg-pink-100 text-pink-800',
  open_day: 'bg-green-100 text-green-800',
  heritage: 'bg-amber-100 text-amber-800',
  other: 'bg-stone-100 text-stone-700',
};

export default function EventCard({ event }: { event: Event }) {
  const typeColour = TYPE_COLOURS[event.event_type] ?? TYPE_COLOURS.other;

  return (
    <Link href={`/events/${event.id}`} className="group block h-full">
      <div
        className="h-full flex flex-col overflow-hidden rounded-2xl bg-white border border-stone-200 hover:border-teal-400 transition-all duration-200"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Image with overlaid pills */}
        <div className="relative aspect-video w-full overflow-hidden bg-stone-100">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-100 to-stone-200" />
          )}

          {/* FREE / TICKETED pill — top right */}
          <span
            className={`absolute top-2.5 right-2.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              event.is_free
                ? 'bg-teal-600 text-white'
                : 'bg-white/90 text-stone-700 border border-stone-200'
            }`}
          >
            {event.is_free ? 'FREE' : 'TICKETED'}
          </span>

          {/* Type badge — bottom left */}
          <span className={`absolute bottom-2.5 left-2.5 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${typeColour}`}>
            {event.event_type.replace('_', ' ')}
          </span>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          <h3
            className="font-semibold text-stone-900 leading-snug line-clamp-2 group-hover:text-teal-700 transition-colors"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {event.title}
          </h3>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{event.institution}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{formatDateRange(event.start_date, event.end_date)}</span>
            </div>
            {event.suburb && (
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{event.suburb}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
