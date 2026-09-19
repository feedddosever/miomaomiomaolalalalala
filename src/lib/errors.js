// Supabase/fetch failures arrive as things like "TypeError: Failed to fetch"
// or "signal timed out", which mean nothing to someone just opening a chest.
// Turn the network-shaped ones into plain language and leave real database
// messages alone -- those are worth reading.
const OFFLINE = /failed to fetch|networkerror|load failed|timed out|timeout|aborted/i

export function friendlyError(err, fallback = 'Something went wrong.') {
  const raw = typeof err === 'string' ? err : err?.message
  if (!raw) return fallback
  if (OFFLINE.test(raw)) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  return raw
}
