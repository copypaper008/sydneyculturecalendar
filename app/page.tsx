import Link from 'next/link';
import { getEvents } from '@/lib/supabase';
import { EVENT_TYPES } from '@/lib/types';

export const revalidate = 3600;

export default async function Home() {
  const events = await getEvents();

  const countByType = EVENT_TYPES.map(({ value, label }) => ({
    value,
    label,
    count: events.filter((e) => e.event_type === value).length,
  })).filter((t) => t.count > 0);

  const freeCount = events.filter((e) => e.is_free).length;

  return (
    <div>
      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e8f5f3 0%, var(--color-cream) 60%, #ede9f6 100%)' }}
      >
        <p className="text-teal-700 text-sm font-semibold tracking-widest uppercase mb-3">
          Sydney, Australia
        </p>
        <h1
          className="text-4xl sm:text-6xl font-bold text-stone-900 leading-tight mb-4 max-w-3xl"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          What&apos;s on in Sydney
        </h1>
        <p className="text-stone-600 text-lg sm:text-xl max-w-xl mb-8">
          Exhibitions, festivals, talks and performances — all in one place.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/events"
            className="px-6 py-3 rounded-full text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--color-teal-primary)' }}
          >
            Explore events
          </Link>
          <Link
            href="/calendar"
            className="px-6 py-3 rounded-full text-stone-700 text-sm font-semibold bg-white border border-stone-200 hover:border-stone-300 transition-all"
          >
            View calendar
          </Link>
        </div>

        {freeCount > 0 && (
          <p className="mt-6 text-sm text-stone-500">
            <span className="font-semibold text-teal-700">{freeCount}</span> free events this season
          </p>
        )}
      </section>

      {/* What's on grid */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2
          className="text-2xl font-bold text-stone-900 mb-8"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          What&apos;s on in Sydney
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {countByType.map(({ value, label, count }) => (
            <Link
              key={value}
              href={`/events?type=${value}`}
              className="group flex flex-col gap-1 p-5 rounded-2xl bg-white border border-stone-200 hover:border-teal-400 hover:shadow-md transition-all"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span
                className="text-3xl font-bold text-teal-700 group-hover:text-teal-600 transition-colors"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {count}
              </span>
              <span className="text-sm font-medium text-stone-700 capitalize">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
