create table if not exists public.simulation_sessions (
  id text primary key check (char_length(id) between 1 and 80),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ecg_patterns (
  id text primary key check (char_length(id) between 1 and 64),
  title text not null check (char_length(title) between 1 and 100),
  category text not null check (category in ('Rhythm', '12-lead')),
  rhythm text not null check (rhythm in ('sinus', 'bradycardia', 'tachycardia', 'afib', 'vtach', 'vfib', 'asystole')),
  suggested_rate integer check (suggested_rate between 0 and 300),
  description text not null check (char_length(description) <= 300),
  territory text,
  morphology text,
  image_url text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ecg_patterns add column if not exists suggested_rate integer check (suggested_rate between 0 and 300);

alter table public.simulation_sessions enable row level security;
alter table public.ecg_patterns enable row level security;

drop policy if exists "simulation sessions are available to simulation clients" on public.simulation_sessions;
drop policy if exists "ECG library is editable by simulation clients" on public.ecg_patterns;
drop policy if exists "ECG library realtime reads" on public.ecg_patterns;
create policy "ECG library realtime reads"
  on public.ecg_patterns for select to anon, authenticated
  using (true);

revoke all on public.simulation_sessions from anon, authenticated;
revoke insert, update, delete on public.ecg_patterns from anon, authenticated;
grant select on public.ecg_patterns to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ecg_patterns'
  ) then
    alter publication supabase_realtime add table public.ecg_patterns;
  end if;
end
$$;
