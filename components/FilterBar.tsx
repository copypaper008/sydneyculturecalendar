'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EVENT_TYPES, INSTITUTIONS } from '@/lib/types';

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

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasActive =
    filters.search ||
    filters.institution !== 'all' ||
    filters.eventType !== 'all' ||
    filters.isFree !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  const reset = () =>
    onChange({ search: '', institution: 'all', eventType: 'all', isFree: 'all', dateFrom: '', dateTo: '' });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search events, venues, tags…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Dropdowns row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select value={filters.institution} onValueChange={(v) => set('institution', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Institution" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All institutions</SelectItem>
            {INSTITUTIONS.map((inst) => (
              <SelectItem key={inst} value={inst}>{inst}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.eventType} onValueChange={(v) => set('eventType', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EVENT_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.isFree} onValueChange={(v) => set('isFree', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Price" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Free & paid</SelectItem>
            <SelectItem value="free">Free only</SelectItem>
            <SelectItem value="paid">Ticketed only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            className="text-xs"
            title="From date"
          />
        </div>
      </div>

      {/* Reset */}
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
