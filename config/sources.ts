import type { SourceDescriptor } from '@/lib/sync/descriptors'

/**
 * Descriptor-driven sources, created with `npm run add-source -- <url> …`.
 *
 * These run through the generic adapter (lib/sync/generic.ts); hand-written
 * adapters live in lib/sync/sources/. Both kinds are merged into one registry
 * (lib/sync/sources/index.ts) and enabled per city via sync.sources in
 * config/site.ts.
 */
export const sourceDescriptors: SourceDescriptor[] = [
  // %%DESCRIPTORS%% — `add-source --save` inserts entries above this line
]
