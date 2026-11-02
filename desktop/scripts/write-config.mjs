// Copies the Supabase address and public (anon) key from the website's
// ../.env.local into src/config.json, which is bundled into the app.
// It's the same publishable key the website already ships to browsers.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.resolve(here, '../../.env.local')
const out = path.resolve(here, '../src/config.json')

const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')])
)

const supabaseUrl = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env.local')
  process.exit(1)
}

fs.writeFileSync(
  out,
  JSON.stringify(
    { supabaseUrl, anonKey, websiteUrl: 'https://miomaomiomaolalalalala.vercel.app' },
    null,
    2
  )
)
console.log('wrote src/config.json')
