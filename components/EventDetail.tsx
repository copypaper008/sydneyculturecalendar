import Link from 'next/link';
import { Calendar, MapPin, Clock, Building2, ExternalLink, Ticket, ArrowLeft, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Event } from '@/lib/types';
import EventCard from './EventCard';

function formatDateRange(start: string, end?: string): string {
  const startDate = new Date(start + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
  if (!end || end === start) return startDate.toLocaleDateString('en-AU', opts);
  const endDate = new Date(end + 'T00:00:00');
  return `${startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })} – ${endDate.toLocaleDateString('en-AU', opts)}`;
}

function formatTime(t?: string): string | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
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

export default function EventDetail({ event, relatedEvents }: { event: Event; relatedEvents?: Event[] }) {
  const typeColour = TYPE_COLOURS[event.event_type] ?? TYPE_COLOURS.other;
  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);

  return (
    <article className="max-w-5xl mx-auto px-4 py-10">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-900 mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to events
      </Link>

      {/* Two-column layout: image left, info right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Left: image */}
        <div>
          {event.image_url ? (
            <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-stone-100">
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="rounded-2xl aspect-[4/3] bg-gradient-to-br from-stone-100 to-stone-200" />
          )}
        </div>

        {/* Right: info */}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${typeColour}`}>
              {event.event_type.replace('_', ' ')}
            </span>
            {event.is_free ? (
              <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">Free admission</Badge>
            ) : (
              <Badge variant="outline" className="text-stone-500">Ticketed</Badge>
            )}
          </div>

          <h1
            className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight mb-5"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {event.title}
          </h1>

          <div className="flex flex-col gap-3 mb-6">
            <InfoRow icon={Building2} label="Institution" value={event.institution} />
            <InfoRow icon={Calendar} label="Dates" value={formatDateRange(event.start_date, event.end_date)} />
            {startTime && (
              <InfoRow icon={Clock} label="Time" value={endTime ? `${startTime} – ${endTime}` : startTime} />
            )}
            {event.venue && <InfoRow icon={MapPin} label="Venue" value={event.venue} />}
            {event.suburb && <InfoRow icon={MapPin} label="Suburb" value={event.suburb} />}
          </div>

          <div className="flex flex-wrap gap-3 mt-auto">
            {event.event_url && (
              <Button asChild className="bg-teal-700 hover:bg-teal-800 text-white gap-2">
                <a href={event.event_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Official website
                </a>
              </Button>
            )}
            {event.ticket_url && (
              <Button asChild variant="outline" className="border-teal-600 text-teal-700 hover:bg-teal-50 gap-2">
                <a href={event.ticket_url} target="_blank" rel="noopener noreferrer">
                  <Ticket className="w-4 h-4" />
                  Get tickets
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mb-8 max-w-2xl">
          <p className="text-stone-700 leading-relaxed">{event.description}</p>
        </div>
      )}

      {/* Tags */}
      {event.tags && event.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-10">
          <Tag className="w-4 h-4 text-stone-400" />
          {event.tags.map((tag) => (
            <span key={tag} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* You may also like */}
      {relatedEvents && relatedEvents.length > 0 && (
        <section>
          <h2
            className="text-xl font-bold text-stone-900 mb-5"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            You may also like
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {relatedEvents.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
      <div>
        <span className="text-stone-500 text-xs uppercase tracking-wide">{label}</span>
        <p className="text-stone-800 font-medium">{value}</p>
      </div>
    </div>
  );
}
