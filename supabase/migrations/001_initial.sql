create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  institution text not null,
  event_type text not null,  -- 'exhibition' | 'festival' | 'talk' | 'performance' | 'open_day' | 'heritage' | 'other'
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  venue text,
  suburb text,
  description text,
  image_url text,
  event_url text,
  ticket_url text,
  is_free boolean default false,
  tags text[],
  created_at timestamptz default now()
);

-- Row Level Security (allow public read access)
alter table events enable row level security;

create policy "Allow public read access"
  on events for select
  using (true);

-- Indexes for common queries
create index if not exists events_start_date_idx on events (start_date);
create index if not exists events_institution_idx on events (institution);
create index if not exists events_event_type_idx on events (event_type);
create index if not exists events_is_free_idx on events (is_free);
