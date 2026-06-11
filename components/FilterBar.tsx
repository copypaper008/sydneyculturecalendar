'use client';

import { X } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { EVENT_TYPE_OPTIONS } from '@/lib/event-types';

export interface Filters {
  search: string;
  institution: string;
  eventType: string;
  isFree: string;
  dateFrom: string;
  dateTo: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const POPULAR = siteConfig.filters.popular;

const selectStyle: React.CSSProperties = {
  height: '38px',
  padding: '0 var(--space-2)',
  border: '1px solid var(--colour-line)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '.85rem',
  color: 'var(--colour-ink)',
  background: 'white',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
};

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search events, venues, artists…"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
        style={{
          width: '100%',
          minHeight: '52px',
          padding: '0 var(--space-4)',
          color: 'var(--colour-ink)',
          background: 'white',
          border: '1px solid var(--colour-line)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '1rem',
          outline: 'none',
          fontFamily: 'var(--font-body)',
          boxShadow: 'var(--shadow-soft)',
        }}
      />

      {/* Popular quick-filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '.8rem', color: 'var(--colour-muted)', fontWeight: 600, marginRight: 'var(--space-1)' }}>
          Popular:
        </span>
        {POPULAR.map(({ label, key, value }) => {
          const active = filters[key as keyof Filters] === value;
          return (
            <button
              key={label}
              onClick={() => set(key as keyof Filters, active ? 'all' : value)}
              style={{
                minHeight: '38px',
                padding: '0 var(--space-3)',
                background: active ? 'var(--colour-primary)' : 'white',
                border: `1px solid ${active ? 'var(--colour-primary)' : 'var(--colour-line)'}`,
                borderRadius: '999px',
                color: active ? 'white' : 'var(--colour-ink)',
                fontSize: '.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Dropdown row */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filters.eventType}
          onChange={(e) => set('eventType', e.target.value)}
          style={selectStyle}
        >
          <option value="all">All event types</option>
          {EVENT_TYPE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filters.institution}
          onChange={(e) => set('institution', e.target.value)}
          style={selectStyle}
        >
          <option value="all">All institutions</option>
          {siteConfig.institutions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={filters.isFree}
          onChange={(e) => set('isFree', e.target.value)}
          style={selectStyle}
        >
          <option value="all">Free &amp; ticketed</option>
          <option value="free">Free only</option>
          <option value="paid">Ticketed only</option>
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            style={selectStyle}
          />
          <span style={{ fontSize: '.8rem', color: 'var(--colour-muted)' }}>to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
            style={selectStyle}
          />
        </div>
      </div>

      {hasActive && (
        <button
          onClick={reset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.82rem', color: 'var(--colour-primary-dark)', fontWeight: 600,
            padding: 0, fontFamily: 'var(--font-body)',
          }}
        >
          <X size={12} /> Clear filters
        </button>
      )}
    </div>
  );
}
