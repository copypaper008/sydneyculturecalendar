/**
 * End-to-end test for the source-discovery pipeline, run against a synthetic
 * museum site served on localhost — no external network needed.
 *
 *   npm run test:discovery
 *
 * Covers: probe strategy detection (listing-links, sitemap fallback, RSS),
 * the generic adapter's extraction ladder (JSON-LD dates, OG meta, visible
 * date ranges, free/type/ongoing detection), and the validator (passes good
 * output, rejects junk).
 */
import { createServer } from 'node:http'
import { probe } from '../lib/sync/discovery/probe'
import { validateRawEvents } from '../lib/sync/discovery/validate'
import { fetchDescriptorEvents } from '../lib/sync/generic'
import { evaluateSourceHealth, sendAlertWebhook, SourceRun } from '../lib/sync/health'
import { closeBrowser, isBrowserConfigured } from '../lib/sync/browser'
import { RawEvent } from '../lib/sync/types'

const thisYear = new Date().getFullYear()
const Y = thisYear + 1 // keep fixture dates in the future

// ── Fixture site ──────────────────────────────────────────────────────────────

function page(title: string, body: string, head = ''): string {
  return `<!doctype html><html><head><title>${title}</title>${head}</head><body><nav><a href="/visit">Visit</a><a href="/about">About</a></nav>${body}</body></html>`
}

const detailPages: Record<string, string> = {
  '/whats-on/ancient-worlds': page('Ancient Worlds | Fixture Museum',
    `<h1>Ancient Worlds</h1><p>Open daily. Adults free.</p><p>1 March – 30 November ${Y}</p>`,
    `<meta property="og:title" content="Ancient Worlds | Fixture Museum">
     <meta property="og:description" content="A landmark exhibition of antiquities.">
     <meta property="og:image" content="/img/ancient.jpg">
     <script type="application/ld+json">{"@type":"ExhibitionEvent","startDate":"${Y}-03-01","endDate":"${Y}-11-30"}</script>`),
  '/whats-on/night-talk-series': page('Night Talks | Fixture Museum',
    `<h1>Night Talks: curator lecture series</h1><p>Tickets: Adult: $25</p><p>Thursday 12 June ${Y}, 6:30pm – 8:00pm</p>`,
    `<meta property="og:title" content="Night Talks | Fixture Museum">
     <meta property="og:description" content="An evening lecture with our curators.">
     <meta property="og:image" content="/img/talks.jpg">
     <script type="application/ld+json">{"@type":"EducationEvent","startDate":"${Y}-06-12"}</script>`),
  '/whats-on/harbour-festival': page('Harbour Festival | Fixture Museum',
    `<h1>Harbour Festival</h1><p>Free entry, all welcome.</p><p>10 – 14 July ${Y}</p>`,
    `<meta property="og:title" content="Harbour Festival | Fixture Museum">
     <meta property="og:description" content="Music, food and light installations.">
     <meta property="og:image" content="https://cdn.example/festival.jpg">`),
  '/whats-on/dinosaur-hall': page('Dinosaur Hall | Fixture Museum',
    `<h1>Dinosaur Hall</h1><p>Our permanent exhibition of fossils. Free with entry.</p>`,
    `<meta property="og:title" content="Dinosaur Hall | Fixture Museum">
     <meta property="og:description" content="Permanent display of dinosaur skeletons.">
     <meta property="og:image" content="/img/dino.jpg">`),
}

const listing = page('What’s On | Fixture Museum',
  Object.keys(detailPages).map((p) => `<article><a href="${p}">link</a></article>`).join('\n'))

const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${Object.keys(detailPages).map((p) => `<url><loc>http://127.0.0.1:PORT${p}</loc></url>`).join('\n')}
  <url><loc>http://127.0.0.1:PORT/about</loc></url>
</urlset>`

const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title>
  ${Object.keys(detailPages).map((p) => `<item><title>x</title><link>http://127.0.0.1:PORT${p}</link></item>`).join('\n')}
</channel></rss>`

// jsListing simulates a client-rendered site: no event links in the HTML
const jsListing = page('What’s On', `<div id="root"></div><script id="__NEXT_DATA__" type="application/json">{}</script>`)

function serve(routes: Record<string, string | null>): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0].replace(/\/$/, '') || '/'
      const body = routes[path]
      if (body == null) { res.writeHead(404); res.end('not found'); return }
      const type = path.endsWith('.xml') || path === '/feed' ? 'application/xml' : 'text/html'
      res.writeHead(200, { 'Content-Type': type })
      res.end(body)
    })
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

// ── Assertions ────────────────────────────────────────────────────────────────

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${cond || !detail ? '' : ` — ${detail}`}`)
  if (!cond) failures++
}

function eventBy(events: RawEvent[], id: string): RawEvent | undefined {
  return events.find((e) => e.source_id === id)
}

async function main() {
  // ── Scenario 1: server-rendered listing → listing-links strategy ────────────
  console.log('\nScenario 1: listing-links site')
  {
    const routes: Record<string, string> = { '/whats-on': listing, '/robots.txt': 'User-agent: *\nDisallow:' , ...detailPages }
    const { base, close } = await serve(routes)
    try {
      const report = await probe(`${base}/whats-on`, 'Fixture Museum')
      check('probe recommends listing-links', report.recommended?.kind === 'listing-links', JSON.stringify(report.recommended))
      check('probe found the /whats-on/ link group', report.linkGroups[0]?.prefix === '/whats-on/', report.linkGroups[0]?.prefix)
      check('probe sampled a detail page with og:title', report.detailSample?.hasOgTitle === true)
      check('draft descriptor produced', !!report.draft)

      const d = { ...report.draft!, institution: 'Fixture Museum', titleSuffixPattern: '\\s*\\|\\s*Fixture Museum$' }
      const events = await fetchDescriptorEvents(d)
      check('extracted all 4 events', events.length === 4, `got ${events.length}`)

      const ancient = eventBy(events, 'ancient-worlds')
      check('JSON-LD dates extracted', ancient?.start_date === `${Y}-03-01` && ancient?.end_date === `${Y}-11-30`, JSON.stringify([ancient?.start_date, ancient?.end_date]))
      check('title suffix stripped', ancient?.title === 'Ancient Worlds', ancient?.title)
      check('exhibition classified', ancient?.event_type === 'exhibition', ancient?.event_type)
      check('og:image absolutised', ancient?.image_url === `${base}/img/ancient.jpg`, ancient?.image_url)

      const talk = eventBy(events, 'night-talk-series')
      check('talk classified', talk?.event_type === 'talk', talk?.event_type)
      check('priced talk not free', talk?.is_free === false)
      check('time range parsed', talk?.start_time === '18:30' && talk?.end_time === '20:00', JSON.stringify([talk?.start_time, talk?.end_time]))

      const festival = eventBy(events, 'harbour-festival')
      check('visible date range parsed', festival?.start_date === `${Y}-07-10` && festival?.end_date === `${Y}-07-14`, JSON.stringify([festival?.start_date, festival?.end_date]))
      check('festival classified + free', festival?.event_type === 'festival' && festival?.is_free === true)

      const dino = eventBy(events, 'dinosaur-hall')
      check('permanent exhibit tagged ongoing', dino?.tags.includes('ongoing') === true, JSON.stringify(dino?.tags))

      const validation = validateRawEvents(events)
      check('validator passes', validation.pass, validation.errors.join('; '))
    } finally { close() }
  }

  // ── Scenario 2: JS-rendered listing → sitemap fallback ──────────────────────
  console.log('\nScenario 2: client-rendered site falls back to sitemap')
  {
    const { base, close } = await serve({} as Record<string, string>)
    close() // placeholder to compute port-substituted fixtures via a second server
    const routes: Record<string, string> = { '/whats-on': jsListing, ...detailPages }
    const srv = await serve(routes)
    try {
      routes['/sitemap.xml'] = sitemap.replaceAll(`http://127.0.0.1:PORT`, srv.base)
      const report = await probe(`${srv.base}/whats-on`, 'Fixture Museum')
      check('probe recommends sitemap', report.recommended?.kind === 'sitemap', JSON.stringify(report.recommended))
      check('Next.js detected', report.capabilities.hasNextData === true)

      const events = await fetchDescriptorEvents(report.draft!)
      check('sitemap strategy extracts events', events.length === 4, `got ${events.length}`)
      check('validator passes', validateRawEvents(events).pass)
    } finally { srv.close() }
  }

  // ── Scenario 3: RSS-only site ───────────────────────────────────────────────
  console.log('\nScenario 3: RSS feed strategy')
  {
    const routes: Record<string, string> = { '/': page('Home', '<p>welcome</p>'), ...detailPages }
    const srv = await serve(routes)
    try {
      routes['/feed'] = rss.replaceAll(`http://127.0.0.1:PORT`, srv.base)
      const events = await fetchDescriptorEvents({
        key: 'fixture', institution: 'Fixture Museum', baseUrl: srv.base,
        listing: { kind: 'rss', feedUrl: `${srv.base}/feed` },
      })
      check('rss strategy extracts events', events.length === 4, `got ${events.length}`)
    } finally { srv.close() }
  }

  // ── Scenario 4: validator rejects junk ──────────────────────────────────────
  console.log('\nScenario 4: validator rejects junk output')
  {
    const junk: RawEvent[] = [
      { title: 'Events', institution: 'X', event_type: 'other', start_date: 'TBA', event_url: '/relative', is_free: false, tags: [], source: 'x', source_id: 'a' },
      { title: 'Events', institution: 'X', event_type: 'other', start_date: '2002-01-01', event_url: 'https://x/e', is_free: false, tags: [], source: 'x', source_id: 'a' },
    ]
    const v = validateRawEvents(junk)
    check('junk fails validation', !v.pass)
    check('junk title flagged', v.errors.some((e) => e.includes('navigation')))
    check('bad date flagged', v.errors.some((e) => e.includes('not YYYY-MM-DD')))
    check('relative URL flagged', v.errors.some((e) => e.includes('not absolute')))
    check('duplicate ids flagged', v.errors.some((e) => e.includes('duplicate')))
  }

  // ── Scenario 5: robots.txt disallow blocks recommendation ──────────────────
  console.log('\nScenario 5: robots.txt disallow is honoured')
  {
    const routes: Record<string, string> = {
      '/whats-on': listing,
      '/robots.txt': 'User-agent: *\nDisallow: /whats-on',
      ...detailPages,
    }
    const srv = await serve(routes)
    try {
      const report = await probe(`${srv.base}/whats-on`)
      check('disallow detected', report.capabilities.robotsDisallowsPath === true)
      check('no strategy recommended', report.recommended === null)
    } finally { srv.close() }
  }

  // ── Scenario 6: health evaluator + alert webhook ────────────────────────────
  console.log('\nScenario 6: source health evaluation')
  {
    const ok = (fetched: number): SourceRun => ({
      source: 's', ok: true, fetched,
      validation: { pass: true, errors: [], warnings: [], stats: { total: fetched, withEndDate: 0, withDescription: 0, withImage: 0, freeCount: 0, typeCounts: {}, dateRange: null } },
      sync: { inserted: fetched, updated: 0, skipped: 0, errors: [] },
    })
    check('healthy source → no alert', evaluateSourceHealth(ok(12), 10) === null)
    const regression = evaluateSourceHealth(ok(0), 10)
    check('0 after healthy → regression', regression?.severity === 'regression', JSON.stringify(regression))
    check('0 with no history → warning', evaluateSourceHealth(ok(0), null)?.severity === 'warning')
    const crashed = evaluateSourceHealth({ source: 's', ok: false, fetched: 0, validation: null, sync: null, error: 'boom' }, 10)
    check('adapter crash → regression', crashed?.severity === 'regression' && crashed.message.includes('boom'))
    const junkRun: SourceRun = { ...ok(5), validation: { pass: false, errors: ['x: bad date'], warnings: [], stats: { total: 5, withEndDate: 0, withDescription: 0, withImage: 0, freeCount: 0, typeCounts: {}, dateRange: null } } }
    check('validation failure → regression', evaluateSourceHealth(junkRun, 5)?.severity === 'regression')

    // Webhook delivery against a capturing server
    const received: string[] = []
    const hook = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => { received.push(body); res.writeHead(200); res.end('ok') })
    })
    await new Promise<void>((r) => hook.listen(0, '127.0.0.1', () => r()))
    const port = (hook.address() as { port: number }).port
    process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`
    const sent = await sendAlertWebhook([{ source: 'mca', severity: 'regression', message: 'returned 0 events' }], 'Test Calendar')
    hook.close()
    delete process.env.ALERT_WEBHOOK_URL
    check('webhook delivered', sent === true)
    const payload = received[0] ?? ''
    check('webhook payload has text + content', payload.includes('"text"') && payload.includes('"content"') && payload.includes('mca'))
    check('no webhook without env/alerts', (await sendAlertWebhook([], 'X')) === false)
  }

  // ── Scenario 7: browser-rendered listing (needs a local Chrome) ─────────────
  console.log('\nScenario 7: JS-rendered listing via headless browser')
  if (!isBrowserConfigured()) {
    console.log('  – skipped: set CHROME_EXECUTABLE_PATH (or BROWSER_WS_ENDPOINT) to run')
  } else {
    // Listing links exist only after JS runs; no sitemap/feed to fall back on
    const renderedListing = `<!doctype html><html><head><title>What’s On</title></head><body><div id="root"></div>
      <script id="__NEXT_DATA__" type="application/json">{}</script>
      <script>
        document.getElementById('root').innerHTML =
          ${JSON.stringify(Object.keys(detailPages).map((p) => `<a href="${p}">e</a>`).join(''))};
      </script></body></html>`
    const srv = await serve({ '/whats-on': renderedListing, ...detailPages })
    try {
      const plain = await probe(`${srv.base}/whats-on`, 'Fixture Museum')
      // plain probe may find nothing or only the render fallback — what matters:
      check('render fallback recommends listing-links', plain.recommended?.kind === 'listing-links', JSON.stringify(plain.recommended))
      check('descriptor marked render', plain.needsRender === true && plain.draft?.render === true)

      const events = await fetchDescriptorEvents(plain.draft!)
      check('rendered pipeline extracts all events', events.length === 4, `got ${events.length}`)
      check('rendered events validate', validateRawEvents(events).pass)
    } finally {
      srv.close()
      await closeBrowser()
    }
  }

  console.log(failures === 0 ? '\nAll discovery tests passed.' : `\n${failures} test(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
