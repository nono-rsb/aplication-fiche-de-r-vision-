// Teste les migrations SQL et les politiques RLS dans un Postgres embarqué
// (PGlite), avec une imitation minimale de l'environnement Supabase.
// Usage : npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const db = await PGlite.create()

// --- Imitation de Supabase -------------------------------------------------
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create schema if not exists storage;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
    name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  grant all on storage.objects to anon, authenticated, service_role;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
`)

const migrationsDir = join(root, 'supabase/migrations')
for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(migrationsDir, f), 'utf8'))
    console.log('✔ migration', f)
  } catch (e) {
    console.error('✘ migration', f, '\n', e.message)
    process.exit(1)
  }
}
try {
  await db.exec(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'))
  console.log('✔ seed.sql')
} catch (e) {
  console.error('✘ seed.sql\n', e.message)
  process.exit(1)
}

// --- Outils de test ------------------------------------------------------------
let failures = 0
const as = async (userId, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`)
  await db.exec(userId ? 'set role authenticated' : 'set role anon')
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}
const ok = (cond, label) => {
  if (cond) console.log('  ✔', label)
  else {
    failures++
    console.error('  ✘', label)
  }
}
const fails = async (fn, label) => {
  try {
    await fn()
    failures++
    console.error('  ✘ (aucune erreur)', label)
  } catch {
    console.log('  ✔', label)
  }
}

const testFiles = readdirSync(join(root, 'supabase/tests')).filter((f) => f.endsWith('.mjs')).sort()
for (const f of testFiles) {
  console.log('\n▶', f)
  const mod = await import(join(root, 'supabase/tests', f))
  await mod.default({ db, as, ok, fails })
}

console.log(failures ? `\n${failures} échec(s)` : '\nTous les tests passent.')
process.exit(failures ? 1 : 0)
