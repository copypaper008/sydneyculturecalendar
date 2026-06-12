/**
 * Add a new institution source from a URL.
 *
 *   npm run add-source -- <whats-on-url> --institution "Name" [options]
 *
 * Options:
 *   --institution "Name"   Institution display name (required to save)
 *   --key slug             Registry key / source id (default: derived from host)
 *   --venue "Venue"        Default venue (default: institution name)
 *   --suburb "Suburb"      Default suburb shown on cards
 *   --free                 Mark every event free (skip free-detection)
 *   --type exhibition      Fallback event type (default: other)
 *   --pattern "regex"      Override the auto-detected link/include pattern
 *   --max 25               Max detail pages per sync
 *   --render               Force browser rendering (needs BROWSER_WS_ENDPOINT
 *                          or CHROME_EXECUTABLE_PATH)
 *   --save                 Append the descriptor to config/sources.ts on pass
 *   --probe-only           Print the probe report and exit
 *
 * Pipeline: probe the URL → draft a descriptor → run the generic adapter →
 * validate the events → print a sample → (--save) register the descriptor.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { probe } from '../lib/sync/discovery/probe'
import { validateRawEvents } from '../lib/sync/discovery/validate'
import { fetchDescriptorEvents } from '../lib/sync/generic'
import { closeBrowser } from '../lib/sync/browser'
import { SourceDescriptor } from '../lib/sync/descriptors'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function main() {
  const url = process.argv[2]
  if (!url || url.startsWith('--')) {
    fail('Usage: npm run add-source -- <whats-on-url> --institution "Name" [--save]')
  }

  const institution = arg('institution')

  console.log(`\n── Probing ${url} …\n`)
  const report = await probe(url, institution, { forceRender: flag('render') })

  console.log(`Fetched with: ${report.fetchedWith ?? 'FAILED'} (status ${report.status})`)
  console.log(`Capabilities:`)
  console.log(`  JSON-LD events on listing:  ${report.capabilities.jsonLdEventCount}`)
  console.log(`  Client-rendered (Next.js):  ${report.capabilities.hasNextData}`)
  console.log(`  RSS/Atom feed:              ${report.capabilities.rssFeedUrl ?? '—'}`)
  console.log(`  WordPress API:              ${report.capabilities.wpApiUrl ?? '—'}`)
  console.log(`  Sitemap:                    ${report.capabilities.sitemapUrl ?? '—'} (${report.capabilities.sitemapMatchCount} matching URLs)`)
  console.log(`  robots.txt disallows path:  ${report.capabilities.robotsDisallowsPath}`)
  if (report.linkGroups.length) {
    console.log(`Link groups on listing page:`)
    for (const g of report.linkGroups.slice(0, 5)) {
      console.log(`  ${g.prefix}  ×${g.count}${g.keywordHit ? '  ← event-like' : ''}`)
    }
  }
  if (report.detailSample) {
    const s = report.detailSample
    console.log(`Detail sample (${s.url}):`)
    console.log(`  og:title ${s.hasOgTitle ? '✓' : '✗'}  og:description ${s.hasOgDescription ? '✓' : '✗'}  og:image ${s.hasOgImage ? '✓' : '✗'}  JSON-LD dates ${s.hasJsonLdDates ? '✓' : '✗'}`)
  }
  for (const note of report.notes) console.log(`  ⚠ ${note}`)

  if (!report.recommended || !report.draft) fail('No viable strategy found — see notes above.')
  console.log(`\nRecommended strategy: ${report.recommended.kind} (confidence: ${report.confidence}${report.needsRender ? ', browser-rendered' : ''})`)

  if (flag('probe-only')) return

  // ── Build the descriptor with CLI overrides ─────────────────────────────────
  const descriptor: SourceDescriptor = {
    ...report.draft,
    key: arg('key') ?? report.draft.key,
    institution: institution ?? report.draft.institution,
    venue: arg('venue') ?? institution ?? report.draft.institution,
    ...(arg('suburb') ? { suburb: arg('suburb') } : {}),
    ...(flag('free') ? { assumeFree: true } : {}),
    ...(arg('type') ? { defaultEventType: arg('type') } : {}),
    ...(arg('max') ? { maxPages: parseInt(arg('max')!, 10) } : {}),
    baseTags: [arg('key') ?? report.draft.key],
  }
  const patternOverride = arg('pattern')
  if (patternOverride) {
    if (descriptor.listing.kind === 'listing-links') descriptor.listing.linkPattern = patternOverride
    if (descriptor.listing.kind === 'sitemap') descriptor.listing.includePattern = patternOverride
  }

  console.log(`\n── Running generic adapter …\n`)
  const events = await fetchDescriptorEvents(descriptor)

  console.log(`\n── Validating ${events.length} events …\n`)
  const result = validateRawEvents(events)

  for (const e of result.errors) console.log(`  ✗ ${e}`)
  for (const w of result.warnings) console.log(`  ⚠ ${w}`)
  console.log(`\nStats: ${JSON.stringify(result.stats, null, 2)}`)

  console.log(`\nSample events:`)
  for (const e of events.slice(0, 5)) {
    console.log(`  • ${e.title}`)
    console.log(`    ${e.start_date}${e.end_date ? ` – ${e.end_date}` : ''} · ${e.event_type} · ${e.is_free ? 'free' : 'ticketed'}`)
    console.log(`    ${e.event_url}`)
  }

  const descriptorBlock = JSON.stringify(descriptor, null, 2)
  if (!result.pass) {
    console.log(`\n✗ Validation FAILED. Adjust --pattern/--type/--free and re-run, or write a bespoke adapter.`)
    console.log(`\nDraft descriptor for reference:\n${descriptorBlock}`)
    process.exit(1)
  }

  console.log(`\n✓ Validation passed.`)

  if (flag('save')) {
    if (!institution) fail('--save requires --institution "Name"')
    const file = join(process.cwd(), 'config', 'sources.ts')
    const src = readFileSync(file, 'utf8')
    const anchor = '  // %%DESCRIPTORS%%'
    if (!src.includes(anchor)) fail(`Anchor comment not found in config/sources.ts — paste the descriptor manually:\n${descriptorBlock}`)
    if (new RegExp(`key:\\s*['"]${descriptor.key}['"]`).test(src)) {
      fail(`A descriptor with key "${descriptor.key}" already exists in config/sources.ts — pass a different --key.`)
    }
    const entry = descriptorBlock.split('\n').map((l) => '  ' + l).join('\n')
    writeFileSync(file, src.replace(anchor, `${entry},\n${anchor}`))
    console.log(`\nSaved to config/sources.ts.`)
    console.log(`Next steps:`)
    console.log(`  1. Add '${descriptor.key}' to sync.sources in config/site.ts (on the city branch).`)
    console.log(`  2. Commit both files and open a PR.`)
  } else {
    console.log(`\nDescriptor (re-run with --save to write it to config/sources.ts):\n${descriptorBlock}`)
  }
}

main()
  .then(() => closeBrowser())
  .catch(async (err) => { await closeBrowser(); fail(String(err?.stack ?? err)) })
