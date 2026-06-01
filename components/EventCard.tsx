import Link from 'next/link';
import { Calendar, MapPin, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  other: 'bg-gray-100 text-gray-700',
};

export default function EventCard({ event }: { event: Event }) {
  const typeColour = TYPE_COLOURS[event.event_type] ?? TYPE_COLOURS.other;

  return (
    <Link href={`/events/${event.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden border border-gray-200 hover:border-teal-400 hover:shadow-md transition-all duration-200">
        {event.image_url && (
          <div className="aspect-video w-full overflow-hidden bg-gray-100">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColour}`}>
              {event.event_type.replace('_', ' ')}
            </span>
            {event.is_free ? (
              <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 text-xs">Free</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-gray-500">Ticketed</Badge>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-teal-700 transition-colors">
            {event.title}
          </h3>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{event.institution}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{formatDateRange(event.start_date, event.end_date)}</span>
            </div>
            {event.suburb && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{event.suburb}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
