'use client';

import { Search, X } from 'lucide-react';
import { EVENT_TYPES } from '@/lib/types';

export interface Filters {
  search: string;
  institution: string;
  eventType: string;
  isFree: string; // 'all' | 'free' | 'paid'
  dateFrom: string;
  dateTo: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const TYPE_CHIP_COLOURS: Record<string, string> = {
  exhibition: 'bg-violet-100 text-violet-800 border-violet-200',
  festival: 'bg-orange-100 text-orange-800 border-orange-200',
  talk: 'bg-sky-100 text-sky-800 border-sky-200',
  performance: 'bg-pink-100 text-pink-800 border-pink-200',
  open_day: 'bg-green-100 text-green-800 border-green-200',
  heritage: 'bg-amber-100 text-amber-800 border-amber-200',
  other: 'bg-stone-100 text-stone-700 border-stone-200',
};

const TYPE_DOT_COLOURS: Record<string, string> = {
  exhibition: 'bg-violet-500',
  festival: 'bg-orange-500',
  talk: 'bg-sky-500',
  performance: 'bg-pink-500',
  open_day: 'bg-green-500',
  heritage: 'bg-amber-500',
  other: 'bg-stone-400',
};

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasActive =
    filters.search ||
    filters.eventType !== 'all' ||
    filters.isFree !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  const reset = () =>
    onChange({ search: '', institution: 'all', eventType: 'all', isFree: 'all', dateFrom: '', dateTo: '' });

  return (
    <div className="flex flex-col gap-4">
      {/* Full-width search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Search events, venues, tags…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-stone-200 text-stone-800 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
          style={{ boxShadow: 'var(--shadow-card)' }}
        />
      </div>

      {/* Event type chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => set('eventType', 'all')}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
            filters.eventType === 'all'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
          }`}
        >
          All types
        </button>
        {EVENT_TYPES.map(({ value, label }) => {
          const active = filters.eventType === value;
          const chipCls = active ? 'bg-teal-600 text-white border-teal-600' : `${TYPE_CHIP_COLOURS[value]} hover:opacity-80`;
          return (
            <button
              key={value}
              onClick={() => set('eventType', active ? 'all' : value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${chipCls}`}
            >
              {!active && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT_COLOURS[value]}`} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Price + date row */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'free', 'paid'] as const).map((val) => (
          <button
            key={val}
            onClick={() => set('isFree', val)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
              filters.isFree === val
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
            }`}
          >
            {val === 'all' ? 'Free & paid' : val === 'free' ? 'Free only' : 'Ticketed only'}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            title="From date"
          />
          <span className="text-stone-400 text-xs">to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
            className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            title="To date"
          />
        </div>
      </div>

      {hasActive && (
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 w-fit"
        >
          <X className="w-3 h-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}
