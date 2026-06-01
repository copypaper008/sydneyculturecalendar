alter table events add column if not exists source text not null default 'manual';
alter table events add column if not exists source_id text; -- external ID for deduplication
create unique index if not exists events_source_id_idx on events (source, source_id) where source_id is not null;
