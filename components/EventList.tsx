'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import EventCard from './EventCard';
import FilterBar, { Filters } from './FilterBar';
import { Event } from '@/lib/types';

/** Map URL query params (?q, ?type, ?institution, ?free, ?from, ?to) to filter state. */
function filtersFromParams(params: URLSearchParams): Filters {
  return {
    search: params.get('q') ?? '',
    institution: params.get('institution') ?? 'all',
    eventType: params.get('type') ?? 'all',
    isFree: params.get('free') === 'true' ? 'free' : params.get('free') ?? 'all',
    dateFrom: params.get('from') ?? '',
    dateTo: params.get('to') ?? '',
  };
}

export default function EventList({ events }: { events: Event[] }) {
  const searchParams = useSearchParams();
  // Remount the list when the URL changes (e.g. nav-bar search while already
  // on /events) so the filter state re-seeds from the new query params
  return (
    <FilterableEventList
      key={searchParams.toString()}
      events={events}
      initialFilters={filtersFromParams(searchParams)}
    />
  );
}

function FilterableEventList({ events, initialFilters }: { events: Event[]; initialFilters: Filters }) {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = [e.title, e.institution, e.venue, e.suburb, e.description, ...(e.tags ?? [])]
          .join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.institution !== 'all' && e.institution !== filters.institution) return false;
      if (filters.eventType !== 'all' && e.event_type !== filters.eventType) return false;
      if (filters.isFree === 'free' && !e.is_free) return false;
      if (filters.isFree === 'paid' && e.is_free) return false;
      // Range overlap: an event already running before dateFrom still matches
      // as long as it hasn't ended (no end_date = open-ended)
      if (filters.dateFrom && e.end_date && e.end_date < filters.dateFrom) return false;
      if (filters.dateTo && e.start_date > filters.dateTo) return false;
      return true;
    });
  }, [events, filters]);

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />

      <p style={{ fontSize: '.88rem', color: 'var(--colour-muted)', marginBottom: 'var(--space-4)' }}>
        <strong style={{ color: 'var(--colour-primary-dark)' }}>{filtered.length}</strong> events
      </p>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-7) 0', color: 'var(--colour-muted)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0 }}>No events found</p>
          <p style={{ marginTop: 'var(--space-2)', fontSize: '.9rem' }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="cards-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
