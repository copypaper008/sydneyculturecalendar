import type { EventType } from '@/lib/types';

/**
 * Per-city site configuration — PLATFORM TEMPLATE.
 *
 * This file on `main` is a placeholder. Each city deployment lives on its own
 * long-lived branch (e.g. `sydney`) whose only intended difference from main
 * is this file. To launch a new city:
 *
 *   1. Branch from `main` (e.g. `melbourne`).
 *   2. Replace every TODO below with the city's values.
 *   3. Write one sync adapter per institution feed in lib/sync/sources/,
 *      register it in lib/sync/sources/index.ts, and list its key in
 *      `sync.sources` below. (Adapters are platform code — add them via a PR
 *      to main so all cities can share them; only the enabled list is per-city.)
 *   4. Point the city's hosting (e.g. a Vercel project's production branch)
 *      at the new branch.
 *
 * Everything else — pages, components, business-rule engine, sync engine —
 * is platform code and must not hardcode city values. See
 * docs/PLATFORM_SPEC.md for the full contract.
 */

export interface EventTypeMeta {
  label: string;
  colour: string;
}

export interface PopularFilter {
  label: string;
  /** Which filter key the pill toggles. */
  key: 'eventType' | 'isFree';
  value: string;
}

export interface SiteConfig {
  city: {
    name: string;
    country: string;
    /** BCP 47 locale used for all date/time formatting. */
    locale: string;
    /** IANA timezone the city's "today" is computed in. */
    timeZone: string;
    /** <html lang> attribute. */
    lang: string;
  };
  brand: {
    siteName: string;
    /** Short brand shown in the nav bar. */
    navTitle: string;
    description: string;
    footerText: string;
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      imageUrl: string;
    };
  };
  theme: {
    /** Mapped onto the --colour-* CSS custom properties in the root layout. */
    colours: {
      ink: string;
      muted: string;
      line: string;
      surface: string;
      surfaceSoft: string;
      primary: string;
      primaryDark: string;
      primarySoft: string;
      accent: string;
      free: string;
      ticketed: string;
    };
    /** Colour and display label per event type, used in every view. */
    eventTypes: Record<EventType, EventTypeMeta>;
  };
  manifest: {
    shortName: string;
    startUrl: string;
    backgroundColor: string;
    categories: string[];
  };
  /** Institution names offered in the filter dropdown. */
  institutions: string[];
  filters: {
    /** Quick-filter pills shown above the event list. */
    popular: PopularFilter[];
  };
  discovery: {
    /** Window (days from today) for the "Free this week" tile. */
    freeWindowDays: number;
    /** Window (days either side of today) for the "New exhibitions" tile. */
    newExhibitionWindowDays: number;
  };
  rules: {
    /**
     * Events whose title or description match any of these patterns are
     * hidden everywhere and skipped at sync time (audience filter).
     */
    excludePatterns: RegExp[];
    /**
     * Events with no end date that are not tagged `ongoing` are presumed
     * closed this many months after their start date.
     */
    staleAfterMonths: number;
    /** Tag that marks permanent / no-closing-date events. */
    ongoingTag: string;
    /** Insert one ongoing event after every N dated events in the feed. */
    ongoingInterleaveEvery: number;
    /**
     * Event types allowed to have already started at sync time when they
     * carry no end date (long-running things like exhibitions/festivals).
     */
    pastStartAllowedTypes: EventType[];
    /** How many events the homepage features. */
    featuredCount: number;
    /** How many same-type events show under "You may also like". */
    relatedCount: number;
  };
  sync: {
    /** Keys into the source registry (lib/sync/sources) to run each sync. */
    sources: string[];
  };
}

export const siteConfig: SiteConfig = {
  city: {
    // TODO: your city
    name: 'Example City',
    country: 'Example Country',
    locale: 'en',
    timeZone: 'UTC',
    lang: 'en',
  },
  brand: {
    // TODO: your branding copy
    siteName: 'Example City Culture Calendar',
    navTitle: 'Example Culture',
    description: 'Discover exhibitions, festivals, talks and performances across the city',
    footerText: 'Culture Calendar — aggregating cultural events across the city',
    hero: {
      eyebrow: 'Example City',
      title: "Discover what's on in Example City",
      subtitle: 'Exhibitions, festivals, talks and performances — all in one place.',
      imageUrl:
        'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1800&q=80',
    },
  },
  theme: {
    // TODO: optionally re-skin per city; these are the platform defaults
    colours: {
      ink: '#151922',
      muted: '#667085',
      line: '#e6e1d8',
      surface: '#fffdf8',
      surfaceSoft: '#f7f3ec',
      primary: '#0f766e',
      primaryDark: '#0b5f58',
      primarySoft: '#d9f3ef',
      accent: '#7c3aed',
      free: '#b8f5e1',
      ticketed: '#f3efe7',
    },
    eventTypes: {
      exhibition: { label: 'Exhibition', colour: '#7c3aed' },
      festival: { label: 'Festival', colour: '#f97316' },
      talk: { label: 'Talk', colour: '#3b82f6' },
      performance: { label: 'Performance', colour: '#ec4899' },
      open_day: { label: 'Open Day', colour: '#10b981' },
      heritage: { label: 'Heritage', colour: '#d97706' },
      other: { label: 'Other', colour: '#6b7280' },
    },
  },
  manifest: {
    // TODO: your PWA identity
    shortName: 'Culture',
    startUrl: '/calendar',
    backgroundColor: '#f8fafc',
    categories: ['entertainment', 'lifestyle', 'education'],
  },
  // TODO: the institutions in your city's filter dropdown. These placeholder
  // entries match the bundled sample dataset (data/seed.ts) so the
  // no-database demo mode stays usable on the template.
  institutions: [
    'Art Gallery of NSW',
    'Museum of Contemporary Art',
    'Powerhouse Museum',
    'Australian National Maritime Museum',
    'State Library of NSW',
    'White Rabbit Gallery',
    'Sydney Living Museums',
    'Sydney Festival',
    'Vivid Sydney',
    "Sydney Writers' Festival",
    'Biennale of Sydney',
    'City of Sydney',
    'Inner West Council',
  ],
  filters: {
    // TODO: which quick-filter pills to promote for your audience
    popular: [
      { label: 'Exhibitions', key: 'eventType', value: 'exhibition' },
      { label: 'Festivals', key: 'eventType', value: 'festival' },
      { label: 'Talks', key: 'eventType', value: 'talk' },
      { label: 'Free', key: 'isFree', value: 'free' },
      { label: 'Performances', key: 'eventType', value: 'performance' },
    ],
  },
  discovery: {
    freeWindowDays: 7,
    newExhibitionWindowDays: 30,
  },
  rules: {
    // Platform defaults — adjust per city's editorial policy
    excludePatterns: [/\bschool\b/i],
    staleAfterMonths: 18,
    ongoingTag: 'ongoing',
    ongoingInterleaveEvery: 3,
    pastStartAllowedTypes: ['exhibition', 'festival'],
    featuredCount: 3,
    relatedCount: 3,
  },
  sync: {
    // TODO: enable your city's source adapters (see lib/sync/sources/index.ts).
    // Empty on the template — the demo runs from the bundled sample data.
    sources: [],
  },
};
