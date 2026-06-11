'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, Tag, Lightbulb } from 'lucide-react';
import { Event, EventType, EVENT_TYPE_VALUES } from '@/lib/types';
import { toInstitutionSlug } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { eventTypeColour, eventTypeLabel } from '@/lib/event-types';
import { isOngoing } from '@/lib/events/rules';
import { avatarColour, initials } from '@/lib/avatar';
import { formatDateRangeLong, formatDate, monthNames, todayISO } from '@/lib/format';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = monthNames('short').map(m => m.toUpperCase());

const ALL_TYPES = EVENT_TYPE_VALUES;

const TRACK_H   = 34; // px height of each event bar
const TRACK_GAP = 6;  // px between stacked bars in one row
const ROW_PAD   = 14; // px top+bottom padding in each row
const INST_W    = 192; // px fixed width of institution column
const MAX_LANES = 5;  // max stacked bars per institution row

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLeap(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInYear(y: number) { return isLeap(y) ? 366 : 365; }

function clampDayOfYear(iso: string, year: number): number {
  const d    = new Date(iso + 'T00:00:00');
  const yS   = new Date(year, 0, 1);
  const yE   = new Date(year, 11, 31);
  const clamp = new Date(Math.min(Math.max(d.getTime(), yS.getTime()), yE.getTime()));
  return Math.floor((clamp.getTime() - yS.getTime()) / 86_400_000) + 1;
}

function eventBar(event: Event, year: number, todayStr: string): { left: number; width: number } {
  const total      = daysInYear(year);
  const start      = clampDayOfYear(event.start_date, year);
  const ongoing    = isOngoing(event);
  // Three states:
  //  1. Has end_date → show to that date
  //  2. 'ongoing' tag, no end_date → show to year-end with stripes
  //  3. No end_date, not ongoing → "closing TBA": show from start up to today (currently showing)
  const effectiveEnd = event.end_date
    ?? (ongoing ? `${year}-12-31` : (todayStr || event.start_date));
  const end    = clampDayOfYear(effectiveEnd, year);
  const left   = (start - 1) / total * 100;
  const width  = Math.max((end - start + 1) / total * 100, 0.8);
  return { left, width };
}

function monthPositions(year: number) {
  const total = daysInYear(year);
  let day = 0;
  return MONTH_LABELS.map((label, i) => {
    const days  = new Date(year, i + 1, 0).getDate();
    const left  = day / total * 100;
    const width = days / total * 100;
    day += days;
    return { label, left, width, days };
  });
}

function todayLeft(year: number): number | null {
  const today = new Date();
  if (today.getFullYear() !== year) return null;
  const total = daysInYear(year);
  const start = new Date(year, 0, 1);
  const diff  = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return diff / total * 100;
}

// Greedy interval scheduling — assigns each event a lane index (0-based)
function assignLanes(events: Event[], year: number, todayStr: string): { event: Event; lane: number; bar: { left: number; width: number } }[] {
  const items = events
    .map(e => ({ event: e, bar: eventBar(e, year, todayStr) }))
    .sort((a, b) => a.event.start_date.localeCompare(b.event.start_date));

  const laneEnd: string[] = [];
  return items.map(({ event, bar }) => {
    // Use the same effective end as eventBar for accurate lane packing
    const endISO = event.end_date ?? (isOngoing(event) ? `${year}-12-31` : (todayStr || event.start_date));
    let lane = laneEnd.findIndex(end => end < event.start_date);
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(endISO); }
    else laneEnd[lane] = endISO;
    return { event, lane, bar };
  });
}

function fmtDate(event: Event): string {
  return formatDateRangeLong(event.start_date, event.end_date);
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tooltip = { event: Event; x: number; y: number };

export default function YearCalendar({ events }: { events: Event[] }) {
  const initYear  = useMemo(() => {
    if (!events.length) return new Date().getFullYear();
    const years = events.map(e => parseInt(e.start_date.slice(0, 4)));
    return Math.max(...years.filter(y => y <= new Date().getFullYear() + 1));
  }, [events]);

  const [year, setYear]                     = useState(initYear);
  const [activeTypes, setActiveTypes]       = useState<Set<EventType>>(new Set(ALL_TYPES));
  const [tooltip, setTooltip]               = useState<Tooltip | null>(null);
  const [todayPct, setTodayPct]             = useState<number | null>(null);
  const [today, setToday]                   = useState('');
  const [expanded, setExpanded]             = useState<Set<string>>(new Set());

  // Avoid SSR/client mismatch for date-dependent state
  useEffect(() => {
    setToday(todayISO());
    setTodayPct(todayLeft(year));
  }, [year]);

  const months = useMemo(() => monthPositions(year), [year]);

  // Filter + group by institution
  const yearEvents = useMemo(() => {
    const curY = today ? parseInt(today.slice(0, 4)) : 0;
    // Cutoff for "closing TBA" events; older ones are likely closed
    const cutoffISO = today
      ? (() => { const d = new Date(today); d.setMonth(d.getMonth() - siteConfig.rules.staleAfterMonths); return d.toISOString().slice(0, 10); })()
      : '';

    return events.filter(e => {
      const sY      = parseInt(e.start_date.slice(0, 4));
      const ongoing = isOngoing(e);

      // ── Year-range gate ──────────────────────────────────────────────────────
      if (sY > year) return false;  // event hasn't started yet in this year

      if (e.end_date) {
        // Dated events: only show in years the event actually spans
        if (parseInt(e.end_date.slice(0, 4)) < year) return false;
      } else if (ongoing) {
        // Ongoing: show in every year from start year onwards (no gate needed)
      } else {
        // Closing TBA: only meaningful in the current year (or start year if viewing past)
        if (year !== curY && year !== sY) return false;
      }

      if (!activeTypes.has(e.event_type)) return false;

      // ── Current-year recency filter ──────────────────────────────────────────
      if (today && year === curY) {
        if (ongoing) return true;
        if (e.end_date) return e.end_date >= today;   // hide definitively past events
        // Closing TBA: hide if started more than the staleness cutoff ago
        return cutoffISO ? e.start_date >= cutoffISO : true;
      }

      return true;
    });
  }, [events, year, activeTypes, today]);

  const institutions = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of yearEvents) {
      if (!map.has(e.institution)) map.set(e.institution, []);
      map.get(e.institution)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [yearEvents]);

  function toggleType(type: EventType) {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type) && next.size > 1) next.delete(type);
      else if (!next.has(type)) next.add(type);
      return next;
    });
  }

  return (
    <div style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-7)' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <div>
          <p style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--colour-primary)', margin: '0 0 var(--space-2)' }}>
            Year Calendar
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: 'var(--colour-ink)', margin: '0 0 var(--space-2)' }}>
            {year} Exhibition Calendar
          </h1>
          <p style={{ color: 'var(--colour-muted)', fontSize: '.95rem', margin: 0, maxWidth: '52ch' }}>
            See when exhibitions and major cultural events are happening across {siteConfig.city.name}&rsquo;s leading institutions.
          </p>
        </div>

        {/* Year navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginTop: '4px' }}>
          <button
            onClick={() => setYear(y => y - 1)}
            aria-label="Previous year"
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--colour-surface)', border: '1px solid var(--colour-line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--colour-ink)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ minWidth: 68, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--colour-surface)', border: '1px solid var(--colour-line)', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '1rem', color: 'var(--colour-ink)', padding: '0 var(--space-2)' }}>
            {year}
          </div>
          <button
            onClick={() => setYear(y => y + 1)}
            aria-label="Next year"
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--colour-surface)', border: '1px solid var(--colour-line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--colour-ink)' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Event type filter chips ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        {ALL_TYPES.map(type => {
          const on    = activeTypes.has(type);
          const color = eventTypeColour(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 13px', borderRadius: '999px', cursor: 'pointer',
                border: `1.5px solid ${on ? color : 'var(--colour-line)'}`,
                background: on ? `${color}18` : 'var(--colour-surface)',
                color: on ? color : 'var(--colour-muted)',
                fontSize: '.8rem', fontWeight: 600,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? color : 'var(--colour-muted)', flexShrink: 0 }} />
              {eventTypeLabel(type)}
            </button>
          );
        })}
      </div>

      {/* ── Gantt grid (scrollable on small screens) ── */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          minWidth: 680,
          background: 'var(--colour-surface)',
          border: '1px solid var(--colour-line)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}>

          {/* Month header row */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--colour-line)', background: 'var(--colour-surface-soft)' }}>
            <div style={{ width: INST_W, flexShrink: 0, padding: '10px 16px', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--colour-muted)', borderRight: '1px solid var(--colour-line)' }}>
              Institution
            </div>
            <div style={{ flex: 1, position: 'relative', height: 38 }}>
              {months.map(({ label, left, width }, mi) => (
                <div
                  key={label}
                  style={{
                    position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--colour-muted)',
                    borderRight: mi < 11 ? '1px solid var(--colour-line)' : 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* No-events state */}
          {institutions.length === 0 && (
            <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--colour-muted)', fontSize: '.9rem' }}>
              No events found for {year}.
            </div>
          )}

          {/* Institution rows */}
          {institutions.map(([institution, instEvents], rowIdx) => {
            const lanes         = assignLanes(instEvents, year, today);
            const allLanes      = lanes.reduce((m, t) => Math.max(m, t.lane + 1), 1);
            const isExpanded    = expanded.has(institution);
            const numLanes      = isExpanded ? allLanes : Math.min(allLanes, MAX_LANES);
            const visibleLanes  = isExpanded ? lanes : lanes.filter(l => l.lane < MAX_LANES);
            const overflowCount = lanes.filter(l => l.lane >= MAX_LANES).length;
            const rowH          = numLanes * TRACK_H + (numLanes - 1) * TRACK_GAP + ROW_PAD * 2 + (overflowCount > 0 || isExpanded ? 24 : 0);
            const suburb        = instEvents[0]?.suburb;
            const color         = avatarColour(institution);

            function toggleExpand() {
              setExpanded(prev => {
                const next = new Set(prev);
                if (next.has(institution)) next.delete(institution);
                else next.add(institution);
                return next;
              });
            }

            return (
              <div
                key={institution}
                style={{ display: 'flex', borderBottom: rowIdx < institutions.length - 1 ? '1px solid var(--colour-line)' : 'none' }}
              >
                {/* Institution cell — links to institution page */}
                <Link
                  href={`/institutions/${toInstitutionSlug(institution)}`}
                  style={{ display: 'flex', textDecoration: 'none' }}
                >
                  <div style={{
                    width: INST_W, flexShrink: 0, minHeight: rowH,
                    padding: '14px 12px 14px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    borderRight: '1px solid var(--colour-line)',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--colour-surface-soft)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '.65rem', fontWeight: 800, letterSpacing: '.03em' }}>
                      {initials(institution)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '.78rem', fontWeight: 700, color: 'var(--colour-primary-dark)', lineHeight: 1.25, wordBreak: 'break-word' }}>
                        {institution}
                      </p>
                      {suburb && (
                        <p style={{ margin: '3px 0 0', fontSize: '.7rem', color: 'var(--colour-muted)' }}>
                          {suburb}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Timeline area */}
                <div style={{ flex: 1, position: 'relative', height: rowH }}>

                  {/* Alternating month shading + dividers */}
                  {months.map(({ left, width }, mi) => (
                    <div key={mi} style={{
                      position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0,
                      background: mi % 2 === 0 ? 'transparent' : 'rgb(0 0 0 / 1.8%)',
                      borderRight: mi < 11 ? '1px solid var(--colour-line)' : 'none',
                      boxSizing: 'border-box',
                    }} />
                  ))}

                  {/* Today line */}
                  {todayPct !== null && (
                    <div style={{
                      position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0,
                      width: 1.5, background: 'var(--colour-primary)', opacity: 0.5, zIndex: 1, pointerEvents: 'none',
                    }} />
                  )}

                  {/* Event bars */}
                  {visibleLanes.map(({ event, lane, bar }) => {
                    const top      = ROW_PAD + lane * (TRACK_H + TRACK_GAP);
                    const color    = eventTypeColour(event.event_type);
                    const wide     = bar.width > 7;
                    const medium   = bar.width > 3;
                    const ongoing  = isOngoing(event);
                    const closingTBA = !event.end_date && !ongoing;
                    // ongoing → diagonal stripes; closing TBA → flat tint, dashed border; dated → flat tint, solid border
                    const barBg    = ongoing
                      ? `repeating-linear-gradient(45deg, ${color}2a 0px, ${color}2a 5px, ${color}0c 5px, ${color}0c 10px)`
                      : `${color}1f`;
                    const barBorder = closingTBA ? `1.5px dashed ${color}` : `1.5px solid ${color}`;
                    const subLabel  = ongoing ? 'Ongoing' : closingTBA ? 'Closing TBA' : fmtDate(event);

                    return (
                      <div
                        key={event.id}
                        style={{ position: 'absolute', left: `${bar.left}%`, width: `${bar.width}%`, top, height: TRACK_H, zIndex: 2 }}
                        onMouseEnter={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setTooltip({ event, x: r.left + r.width / 2, y: r.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <Link href={`/events/${event.id}`} style={{ display: 'block', height: '100%' }}>
                          <div style={{
                            height: '100%', borderRadius: 6,
                            background: barBg,
                            border: barBorder,
                            padding: '3px 7px',
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center',
                            boxSizing: 'border-box',
                          }}>
                            {medium && (
                              <p style={{ margin: 0, fontSize: '.67rem', fontWeight: 700, color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {event.title}
                              </p>
                            )}
                            {wide && (
                              <p style={{ margin: '1px 0 0', fontSize: '.6rem', color: 'var(--colour-muted)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {subLabel}
                              </p>
                            )}
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                  {(overflowCount > 0 || isExpanded) && (
                    <button
                      onClick={toggleExpand}
                      style={{
                        position: 'absolute', bottom: 4, left: 8,
                        fontSize: '.65rem', fontWeight: 700,
                        color: 'var(--colour-primary-dark)',
                        background: 'var(--colour-surface)',
                        border: '1px solid var(--colour-primary)',
                        borderRadius: '999px', padding: '2px 10px',
                        cursor: 'pointer', lineHeight: 1.4,
                      }}
                    >
                      {isExpanded ? 'Show less' : `+${overflowCount} more`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tip ── */}
      <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--colour-surface)', border: '1px solid var(--colour-line)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Lightbulb size={18} color="var(--colour-primary)" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--colour-muted)' }}>
          <strong style={{ color: 'var(--colour-ink)' }}>Tip</strong> — Click on any event bar to view details and book tickets.
        </p>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
            zIndex: 200,
            background: 'var(--colour-surface)',
            border: '1px solid var(--colour-line)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            boxShadow: '0 8px 32px rgb(21 25 34 / 14%)',
            minWidth: 240,
            maxWidth: 300,
            pointerEvents: 'none',
          }}
        >
          <p style={{ margin: '0 0 5px', fontSize: '.65rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: eventTypeColour(tooltip.event.event_type) }}>
            {eventTypeLabel(tooltip.event.event_type)}
          </p>
          <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '.9rem', color: 'var(--colour-ink)', lineHeight: 1.3 }}>
            {tooltip.event.title}
          </p>
          <p style={{ margin: '0 0 10px', fontSize: '.8rem', color: 'var(--colour-muted)' }}>
            {tooltip.event.institution}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: 'var(--colour-muted)' }}>
              <Calendar size={12} style={{ flexShrink: 0 }} />
              {isOngoing(tooltip.event)
                ? 'Ongoing'
                : !tooltip.event.end_date
                  ? `Opens ${formatDate(tooltip.event.start_date, { day: 'numeric', month: 'long', year: 'numeric' })} · Closing date TBA`
                  : fmtDate(tooltip.event)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: 'var(--colour-muted)' }}>
              <Tag size={12} style={{ flexShrink: 0 }} />
              {tooltip.event.is_free ? 'Free' : 'Ticketed'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
