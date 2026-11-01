// Envoie les PDF de démonstration (supabase/seed-files) dans le bucket « sheets ».
// Usage :
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-seed-files.mjs
// La clé service_role se trouve dans Supabase → Project Settings → API. Ne la commite jamais.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Définis SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const DEMO_CLASS = '00000000-0000-4000-8000-000000000001'
const dir = new URL('../supabase/seed-files/', import.meta.url).pathname

for (const file of readdirSync(dir).filter((f) => f.endsWith('.pdf'))) {
  const path = `published/${DEMO_CLASS}/${file}`
  const res = await fetch(`${url}/storage/v1/object/sheets/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: readFileSync(join(dir, file)),
  })
  console.log(res.ok ? '✔' : '✘', path, res.ok ? '' : await res.text())
}
