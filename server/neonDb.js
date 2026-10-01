import { neon } from '@neondatabase/serverless'

let sqlClient
let schemaPromise

export function getNeonSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  sqlClient ??= neon(process.env.DATABASE_URL)
  return sqlClient
}

export async function ensureDatabaseSchema() {
  if (!schemaPromise) {
    const sql = getNeonSql()
    schemaPromise = (async () => {
      await sql`create table if not exists public.simulation_sessions (
        id text primary key,
        state jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
      await sql`alter table public.simulation_sessions add column if not exists created_at timestamptz`
      await sql`update public.simulation_sessions set created_at = updated_at where created_at is null`
      await sql`alter table public.simulation_sessions alter column created_at set default now()`
      await sql`alter table public.simulation_sessions alter column created_at set not null`
      await sql`create index if not exists simulation_sessions_created_at_idx on public.simulation_sessions (created_at)`
      await sql`create table if not exists public.expired_simulation_sessions (
        id text primary key,
        expired_at timestamptz not null
      )`
      await sql`create table if not exists public.session_participants (
        session_id text not null references public.simulation_sessions(id) on delete cascade,
        client_id text not null,
        role text not null check (role in ('tutor', 'monitor')),
        last_seen timestamptz not null default now(),
        primary key (session_id, client_id)
      )`
      await sql`create index if not exists session_participants_presence_idx on public.session_participants (session_id, role, last_seen)`
      await sql`create table if not exists public.ecg_patterns (
        id text primary key,
        title text not null,
        category text not null check (category in ('Rhythm', '12-lead')),
        rhythm text not null,
        suggested_rate integer,
        description text not null,
        territory text,
        morphology text,
        image_url text,
        sort_order integer not null default 0,
        updated_at timestamptz not null default now()
      )`
      await sql`create table if not exists public.scenario_presets (
        id text primary key,
        name text not null,
        tone text not null,
        icon text not null,
        state_patch jsonb not null,
        sort_order integer not null default 0,
        updated_at timestamptz not null default now()
      )`
    })().catch((error) => {
      schemaPromise = undefined
      throw error
    })
  }
  return schemaPromise
}

export async function expireSimulationSessionIfDue(sql, sessionId) {
  const rows = await sql`select
    exists(select 1 from public.expired_simulation_sessions where id = ${sessionId}) as expired,
    exists(select 1 from public.simulation_sessions where id = ${sessionId} and created_at <= now() - interval '48 hours') as due`
  if (!rows[0]?.expired && !rows[0]?.due) return false

  await sql`insert into public.expired_simulation_sessions (id, expired_at)
    select id, created_at + interval '48 hours' from public.simulation_sessions
    where id = ${sessionId} and created_at <= now() - interval '48 hours'
    on conflict (id) do nothing`
  await sql`delete from public.simulation_sessions where id = ${sessionId}`
  return true
}

export async function purgeExpiredSimulationSessions() {
  const sql = getNeonSql()
  await ensureDatabaseSchema()
  await sql`insert into public.expired_simulation_sessions (id, expired_at)
    select id, created_at + interval '48 hours' from public.simulation_sessions
    where created_at <= now() - interval '48 hours'
    on conflict (id) do nothing`
  const rows = await sql`delete from public.simulation_sessions
    where created_at <= now() - interval '48 hours' returning id`
  return rows.length
}
