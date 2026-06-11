/**
 * Apply all database migrations to a Supabase/Postgres database.
 *
 *   DATABASE_URL="postgresql://…" npm run db:migrate
 *
 * Get the URL from Supabase: Project Settings → Database → Connection string.
 * Prefer the "Session pooler" URI (IPv4) — the direct connection is
 * IPv6-only on some plans. The URL contains your database password: treat it
 * as a secret and don't commit it.
 *
 * Migrations are idempotent, so this is safe to run repeatedly — each file
 * skips whatever already exists. Files run in filename order from
 * supabase/migrations/.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    if (process.argv.includes('--if-configured')) {
      // Build-time mode: no database configured is a valid state (demo mode)
      console.log('db:migrate — DATABASE_URL not set, skipping migrations')
      return
    }
    console.error('Set DATABASE_URL to your Postgres connection string.')
    console.error('Supabase: Project Settings → Database → Connection string (Session pooler).')
    process.exit(1)
  }

  const dir = join(process.cwd(), 'supabase', 'migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) {
    console.error(`No .sql files found in ${dir}`)
    process.exit(1)
  }

  const client = new Client({
    connectionString: url,
    // Supabase requires TLS; local/test servers usually don't support it
    ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  try {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf8')
      process.stdout.write(`applying ${file} … `)
      await client.query(sql)
      console.log('✓')
    }

    const { rows } = await client.query(`
      select
        exists (select 1 from pg_type where typname = 'event_type')                       as enum_ok,
        exists (select 1 from information_schema.tables  where table_name = 'events')     as events_ok,
        exists (select 1 from information_schema.columns where table_name = 'events'
                and column_name = 'source')                                               as source_tracking_ok,
        exists (select 1 from information_schema.tables  where table_name = 'sync_runs')  as health_ok,
        (select count(*)::int from events)                                                as event_count
    `)
    const s = rows[0]
    console.log('\nDatabase state:')
    console.log(`  enum:            ${s.enum_ok ? '✓' : '✗'}`)
    console.log(`  events table:    ${s.events_ok ? '✓' : '✗'}`)
    console.log(`  source tracking: ${s.source_tracking_ok ? '✓' : '✗'}`)
    console.log(`  health history:  ${s.health_ok ? '✓' : '✗'}`)
    console.log(`  events in table: ${s.event_count}`)
    const ok = s.enum_ok && s.events_ok && s.source_tracking_ok && s.health_ok
    console.log(ok ? '\n✓ Fully migrated.' : '\n✗ Something is missing — see above.')
    process.exitCode = ok ? 0 : 1
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message ?? err}`)
  process.exit(1)
})
