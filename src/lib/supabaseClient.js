import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced in the UI too (see App.jsx), but this makes the problem
  // obvious immediately in the browser console during setup.
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to a .env.local file (see .env.example).'
  )
}

// A request that connects but never answers used to hang forever: the app
// sat on "Loading today's chest…" with no error and no way out. Every call
// now gives up after this long and surfaces a real failure instead.
const REQUEST_TIMEOUT_MS = 15000

function fetchWithTimeout(input, init = {}) {
  // Abort through a controller rather than AbortSignal.timeout(). The
  // timeout signal rejects with a TimeoutError, and postgrest-js only
  // stops its own retry loop for an AbortError -- so a hung request was
  // retried 3 more times, each with a fresh timeout, leaving the spinner
  // up for about a minute. A controller abort reads as AbortError and
  // propagates immediately.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Keep honouring a caller-supplied signal alongside our own.
  const caller = init.signal
  if (caller) {
    if (caller.aborted) controller.abort(caller.reason)
    else caller.addEventListener('abort', () => controller.abort(caller.reason), { once: true })
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function makeClient() {
  if (!supabaseConfigured) {
    // createClient throws "supabaseUrl is required." on empty config, and
    // it throws while this module is being imported -- before React ever
    // mounts. That blanked the entire page and made the "not connected"
    // notice in App.jsx unreachable, which is the worst possible way to
    // report a missing environment variable. Hand back a stand-in that
    // explains itself only if something actually tries to use it.
    return new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Supabase is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY were missing when this build was made.'
          )
        },
      }
    )
  }
  return createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchWithTimeout } })
}

export const supabase = makeClient()
