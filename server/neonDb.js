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
        updated_at timestamptz not null default now()
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
