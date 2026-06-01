'use client';

import { useState, useMemo } from 'react';
import EventCard from './EventCard';
import FilterBar, { Filters } from './FilterBar';
import { Event } from '@/lib/types';

const DEFAULT_FILTERS: Filters = {
  search: '',
  institution: 'all',
  eventType: 'all',
  isFree: 'all',
  dateFrom: '',
  dateTo: '',
};

export default function EventList({ events }: { events: Event[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

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
      if (filters.dateFrom && e.start_date < filters.dateFrom) return false;
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
