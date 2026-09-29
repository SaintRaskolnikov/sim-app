create table if not exists public.simulation_sessions (
  id text primary key check (char_length(id) between 1 and 80),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ecg_patterns (
  id text primary key check (char_length(id) between 1 and 64),
  title text not null check (char_length(title) between 1 and 100),
  category text not null check (category in ('Rhythm', '12-lead')),
  rhythm text not null,
  suggested_rate integer check (suggested_rate between 0 and 300),
  description text not null check (char_length(description) <= 300),
  territory text,
  morphology text,
  image_url text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.scenario_presets (
  id text primary key check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 80),
  tone text not null check (tone in ('coral', 'amber', 'teal')),
  icon text not null check (icon in ('siren', 'heart', 'activity')),
  state_patch jsonb not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ecg_patterns add column if not exists suggested_rate integer check (suggested_rate between 0 and 300);
alter table public.ecg_patterns drop constraint if exists ecg_patterns_rhythm_check;
alter table public.ecg_patterns add constraint ecg_patterns_rhythm_check check (rhythm in ('sinus', 'bradycardia', 'tachycardia', 'afib', 'svt', 'flutter', 'vtach', 'torsades', 'vfib', 'fine-vfib', 'asystole', 'junctional-escape', 'ventricular-escape', 'aivr', 'mobitz1', 'mobitz2', 'complete-block', 'sinus-pause'));

alter table public.simulation_sessions enable row level security;
alter table public.ecg_patterns enable row level security;
alter table public.scenario_presets enable row level security;

drop policy if exists "simulation sessions are available to simulation clients" on public.simulation_sessions;
drop policy if exists "ECG library is editable by simulation clients" on public.ecg_patterns;
drop policy if exists "ECG library realtime reads" on public.ecg_patterns;
drop policy if exists "Scenario preset realtime reads" on public.scenario_presets;
create policy "ECG library realtime reads"
  on public.ecg_patterns for select to anon, authenticated
  using (true);
create policy "Scenario preset realtime reads"
  on public.scenario_presets for select to anon, authenticated
  using (true);

revoke all on public.simulation_sessions from anon, authenticated;
revoke insert, update, delete on public.ecg_patterns from anon, authenticated;
revoke insert, update, delete on public.scenario_presets from anon, authenticated;
grant select on public.ecg_patterns to anon, authenticated;
grant select on public.scenario_presets to anon, authenticated;

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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scenario_presets'
  ) then
    alter publication supabase_realtime add table public.scenario_presets;
  end if;
end
$$;
