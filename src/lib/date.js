// All dates in this app are plain "YYYY-MM-DD" strings in the browser's
// local timezone -- not UTC -- so "today" always matches the calendar
// day the user is actually experiencing.

export function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

export function toPretty(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function toShort(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Start and end of the browser's local day, as instants. Used to ask
// "was this opened today?" of a timestamptz column without dragging the
// database's timezone into it.
export function localDayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}
