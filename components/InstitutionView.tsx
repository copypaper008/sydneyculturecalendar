'use client';

import { useState, useMemo } from 'react';
import { LayoutGrid, GanttChartSquare } from 'lucide-react';
import { Event } from '@/lib/types';
import EventCard from './EventCard';
import YearCalendar from './YearCalendar';

// Avatar colour — must match YearCalendar's palette so the colour is consistent
const AVATAR_PALETTE = ['#7c3aed','#0f766e','#d97706','#dc2626','#2563eb','#0891b2','#65a30d','#c026d3','#0e7490','#be185d'];
function avatarColour(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(w => w.length > 2 && /[A-Z]/.test(w[0]));
  if (words.length >= 2) return words[0][0] + words[1][0];
  return name.slice(0, 2).toUpperCase();
}

type View = 'list' | 'year';

export default function InstitutionView({ institution, events }: { institution: string; events: Event[] }) {
  const [view, setView] = useState<View>('list');

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [events],
  );

  const color = avatarColour(institution);
  const suburb = events[0]?.suburb;

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', border: 'none', cursor: 'pointer',
    fontSize: '.82rem', fontWeight: 700, fontFamily: 'var(--font-body)',
  };

  return (
    <div style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-7)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '.85rem', fontWeight: 800, letterSpacing: '.03em' }}>
            {initials(institution)}
          </div>
          <div>
            <p style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--colour-primary)', margin: '0 0 4px' }}>
              Institution
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2.4rem)', color: 'var(--colour-ink)', margin: 0, letterSpacing: '-.03em' }}>
              {institution}
            </h1>
            {suburb && (
              <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: 'var(--colour-muted)' }}>
                {suburb}
              </p>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--colour-line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, alignSelf: 'flex-start' }}>
          <button
            onClick={() => setView('list')}
            style={{ ...btnBase, background: view === 'list' ? 'var(--colour-primary)' : 'var(--colour-surface)', color: view === 'list' ? 'white' : 'var(--colour-muted)' }}
          >
            <LayoutGrid size={14} /> Events
          </button>
          <button
            onClick={() => setView('year')}
            style={{ ...btnBase, background: view === 'year' ? 'var(--colour-primary)' : 'var(--colour-surface)', color: view === 'year' ? 'white' : 'var(--colour-muted)', borderLeft: '1px solid var(--colour-line)' }}
          >
            <GanttChartSquare size={14} /> Year
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {view === 'list' ? (
        <>
          <p style={{ fontSize: '.88rem', color: 'var(--colour-muted)', marginBottom: 'var(--space-4)' }}>
            <strong style={{ color: 'var(--colour-primary-dark)' }}>{sorted.length}</strong> event{sorted.length !== 1 ? 's' : ''}
          </p>

          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-7) 0', color: 'var(--colour-muted)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0 }}>No events</p>
              <p style={{ marginTop: 'var(--space-2)', fontSize: '.9rem' }}>Check back soon for new exhibitions and programs.</p>
            </div>
          ) : (
            <div className="cards-3">
              {sorted.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </>
      ) : (
        // Pass only this institution's events; YearCalendar handles year nav + filtering
        <YearCalendar events={events} />
      )}
    </div>
  );
}
