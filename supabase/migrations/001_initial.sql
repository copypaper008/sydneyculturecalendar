-- Event type enum
create type event_type as enum (
  'exhibition',
  'festival',
  'talk',
  'performance',
  'open_day',
  'heritage',
  'other'
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  institution text not null,
  event_type event_type not null,
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
  is_free boolean not null default false,
  tags text[] not null default '{}',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  constraint end_date_after_start check (end_date is null or end_date >= start_date),
  constraint end_time_after_start check (end_time is null or start_time is null or end_time > start_time)
);

-- Row Level Security (public read, no anonymous writes)
alter table events enable row level security;

create policy "Allow public read access"
  on events for select
  using (true);

-- Indexes
create index events_start_date_idx on events (start_date);
create index events_end_date_idx on events (end_date);
create index events_institution_idx on events (institution);
create index events_event_type_idx on events (event_type);
create index events_is_free_idx on events (is_free);
create index events_suburb_idx on events (suburb);
create index events_search_idx on events using gin (search_vector);

-- Trigger to keep search_vector up to date
create or replace function events_search_vector_update() returns trigger as $$
begin
  new.search_vector :=
    to_tsvector('english',
      coalesce(new.title, '') || ' ' ||
      coalesce(new.institution, '') || ' ' ||
      coalesce(new.venue, '') || ' ' ||
      coalesce(new.suburb, '') || ' ' ||
      coalesce(new.description, '') || ' ' ||
      coalesce(array_to_string(new.tags, ' '), '')
    );
  return new;
end;
$$ language plpgsql;

create trigger events_search_vector_trigger
  before insert or update on events
  for each row execute function events_search_vector_update();
