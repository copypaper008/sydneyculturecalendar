import { EventType, EVENT_TYPE_VALUES } from '@/lib/types';
import { siteConfig } from '@/config/site';

/** Display label for an event type, from the city config. */
export function eventTypeLabel(type: EventType): string {
  return siteConfig.theme.eventTypes[type]?.label ?? type.replace('_', ' ');
}

/** Display colour for an event type, from the city config. */
export function eventTypeColour(type: EventType): string {
  return siteConfig.theme.eventTypes[type]?.colour ?? siteConfig.theme.eventTypes.other.colour;
}

/** Ordered {value, label} pairs for selects and chip rows. */
export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] =
  EVENT_TYPE_VALUES.map((value) => ({ value, label: eventTypeLabel(value) }));
