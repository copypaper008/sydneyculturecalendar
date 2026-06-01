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
          .join(' ')
          .toLowerCase();
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
    <div className="flex flex-col gap-6">
      <FilterBar filters={filters} onChange={setFilters} />
      <p className="text-sm text-gray-500">
        Showing <span className="font-semibold text-gray-700">{filtered.length}</span> event{filtered.length !== 1 ? 's' : ''}
      </p>
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">No events found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
