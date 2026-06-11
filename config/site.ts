import type { EventType } from '@/lib/types';

/**
 * Per-city site configuration.
 *
 * Everything a new city deployment needs to change lives in this file:
 * branding copy, locale/timezone, institutions, ingestion sources, theme
 * colours, and the editorial business rules documented in
 * docs/PLATFORM_SPEC.md §7 and §11. Platform code must not hardcode any of
 * these values — it reads them from `siteConfig`.
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
    name: 'Sydney',
    country: 'Australia',
    locale: 'en-AU',
    timeZone: 'Australia/Sydney',
    lang: 'en',
  },
  brand: {
    siteName: 'Sydney Culture Calendar',
    navTitle: 'Sydney Culture',
    description: 'Discover exhibitions, festivals, talks and performances across Sydney',
    footerText: 'Sydney Culture Calendar — aggregating cultural events across the city',
    hero: {
      eyebrow: 'Sydney, Australia',
      title: "Discover what's on in Sydney",
      subtitle: 'Exhibitions, festivals, talks and performances — all in one place.',
      imageUrl:
        'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1800&q=80',
    },
  },
  theme: {
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
    shortName: 'SCC',
    startUrl: '/calendar',
    backgroundColor: '#f8fafc',
    categories: ['entertainment', 'lifestyle', 'education'],
  },
  institutions: [
    'Art Gallery of NSW',
    'Museum of Contemporary Art',
    'Powerhouse Museum',
    'Australian National Maritime Museum',
    'State Library of NSW',
    'White Rabbit Gallery',
    'Australian Museum',
    'Sydney Living Museums',
    'Sydney Festival',
    'Vivid Sydney',
    "Sydney Writers' Festival",
    'Biennale of Sydney',
    'City of Sydney',
    'Inner West Council',
  ],
  filters: {
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
    excludePatterns: [/\bschool\b/i],
    staleAfterMonths: 18,
    ongoingTag: 'ongoing',
    ongoingInterleaveEvery: 3,
    pastStartAllowedTypes: ['exhibition', 'festival'],
    featuredCount: 3,
    relatedCount: 3,
  },
  sync: {
    sources: ['slnsw', 'mca', 'agnsw', 'powerhouse', 'ausmuseum', 'maritime', 'whiterabbit'],
  },
};
