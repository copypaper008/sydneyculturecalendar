-- Per-source sync run history, used for health checks / alerting.
-- Written by the sync engine (service role); not publicly readable.
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  source text not null,
  ok boolean not null,
  fetched int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  skipped int not null default 0,
  errors text[] not null default '{}',
  warnings text[] not null default '{}'
);

create index if not exists sync_runs_source_run_at_idx on sync_runs (source, run_at desc);

-- RLS on, no policies: only the service-role key (which bypasses RLS) can
-- read or write run history.
alter table sync_runs enable row level security;
