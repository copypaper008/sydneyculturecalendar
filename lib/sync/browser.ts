/**
 * Optional rendered-fetch layer for JS-rendered sites.
 *
 * Sites that build their event listings client-side (no links/dates in the
 * raw HTML) can be scraped by marking the descriptor with `render: true`.
 * Pages are then loaded in a real browser and the post-render DOM is used.
 *
 * Browser backends, in order of preference:
 *   1. BROWSER_WS_ENDPOINT  — a remote CDP websocket (e.g. a Browserless
 *      instance). Recommended for Vercel: no binary ships with the function.
 *   2. CHROME_EXECUTABLE_PATH — a local Chrome/Chromium binary (local dev).
 *
 * If neither is configured, rendered fetches fall back to plain HTTP with a
 * warning, so a misconfigured environment degrades rather than breaks.
 */
import type { Browser } from 'puppeteer-core'
import { BROWSER_HEADERS } from './scrape'

const RENDER_TIMEOUT_MS = 30_000

let browserPromise: Promise<Browser> | null = null

export function isBrowserConfigured(): boolean {
  return !!(process.env.BROWSER_WS_ENDPOINT || process.env.CHROME_EXECUTABLE_PATH)
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = await import('puppeteer-core')
      const wsEndpoint = process.env.BROWSER_WS_ENDPOINT
      if (wsEndpoint) {
        return puppeteer.connect({ browserWSEndpoint: wsEndpoint })
      }
      const executablePath = process.env.CHROME_EXECUTABLE_PATH
      if (!executablePath) throw new Error('No browser configured')
      return puppeteer.launch({
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
    })()
    browserPromise.catch(() => { browserPromise = null })
  }
  return browserPromise
}

/**
 * Load a page in the browser and return the rendered HTML, or null on
 * failure. Reuses one browser across calls — call closeBrowser() when done.
 */
export async function renderPage(url: string): Promise<string | null> {
  if (!isBrowserConfigured()) return null
  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    try {
      await page.setUserAgent(BROWSER_HEADERS['User-Agent'])
      await page.goto(url, { waitUntil: 'networkidle2', timeout: RENDER_TIMEOUT_MS })
      return await page.content()
    } finally {
      await page.close().catch(() => {})
    }
  } catch (err) {
    console.error(`[browser] render failed for ${url}:`, err)
    return null
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const p = browserPromise
  browserPromise = null
  try {
    const browser = await p
    // disconnect() for remote endpoints, close() for locally launched
    if (process.env.BROWSER_WS_ENDPOINT) await browser.disconnect()
    else await browser.close()
  } catch { /* already gone */ }
}
