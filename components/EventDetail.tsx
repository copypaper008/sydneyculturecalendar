import Link from 'next/link';
import { Calendar, MapPin, Clock, Building2, ExternalLink, Ticket, ArrowLeft, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Event } from '@/lib/types';

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
  other: 'bg-gray-100 text-gray-700',
};

export default function EventDetail({ event }: { event: Event }) {
  const typeColour = TYPE_COLOURS[event.event_type] ?? TYPE_COLOURS.other;
  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to events
      </Link>

      {event.image_url && (
        <div className="rounded-xl overflow-hidden mb-6 aspect-video bg-gray-100">
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColour}`}>
          {event.event_type.replace('_', ' ')}
        </span>
        {event.is_free ? (
          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">Free admission</Badge>
        ) : (
          <Badge variant="outline" className="text-gray-500">Ticketed</Badge>
        )}
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-4">
        {event.title}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <InfoRow icon={Building2} label="Institution" value={event.institution} />
        <InfoRow icon={Calendar} label="Dates" value={formatDateRange(event.start_date, event.end_date)} />
        {(startTime) && (
          <InfoRow icon={Clock} label="Time" value={endTime ? `${startTime} – ${endTime}` : startTime} />
        )}
        {event.venue && <InfoRow icon={MapPin} label="Venue" value={event.venue} />}
        {event.suburb && <InfoRow icon={MapPin} label="Suburb" value={event.suburb} />}
      </div>

      {event.description && (
        <div className="prose prose-gray max-w-none mb-8">
          <p className="text-gray-700 leading-relaxed">{event.description}</p>
        </div>
      )}

      {event.tags && event.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <Tag className="w-4 h-4 text-gray-400" />
          {event.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
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
        <span className="text-gray-500 text-xs uppercase tracking-wide">{label}</span>
        <p className="text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}
