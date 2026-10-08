// Pure helpers shared by the main process and the tests. No Electron, no
// network: everything here is easy to check on its own.

// Same rules as the website (src/lib/date.js): dates are "YYYY-MM-DD" in
// the Mac's local timezone, so "today" is the day the person is living in.
function todayISO(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function localDayBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// daily_content holds plain strings; treasures hold {text, done}. A row
// edited by hand can hold either, or null. Same as normalizeQuests() on
// the website, so both read every row the same way.
function normalizeQuests(quests) {
  if (!Array.isArray(quests)) return []
  return quests.map((q) =>
    typeof q === 'string'
      ? { text: q, done: false }
      : { ...q, text: typeof q?.text === 'string' ? q.text : '', done: q?.done === true }
  )
}

function countDone(rows) {
  let n = 0
  for (const row of rows ?? []) {
    for (const q of normalizeQuests(row?.quests)) if (q.done) n++
  }
  return n
}

// ---- how brave the kitty is ----
// One more level for every 3 quests ticked since the kitty was named,
// up to level 10 (30 quests): fully moved in.
const QUESTS_PER_LEVEL = 3
const MAX_LEVEL = 10

const LEVEL_LINES = [
  '{name} only leaves paw prints so far.',
  '{name} slipped past as a faint shadow.',
  "{name}'s shadow is getting clearer.",
  'Two little ear tips have been spotted.',
  '{name} peeks out sometimes.',
  '{name} lets you see their face now.',
  "{name} isn't so shy any more.",
  '{name} came to sit nearby. Almost see-through.',
  '{name} sits with you sometimes.',
  '{name} naps on your screen now.',
  '{name} has fully moved in.',
]

function levelFor(bravery) {
  return Math.max(0, Math.min(MAX_LEVEL, Math.floor(bravery / QUESTS_PER_LEVEL)))
}

// Ticks towards the next level (0, 1 or 2), measured from the level the
// kitty has actually reached, which never goes down.
function progressFor(bravery, level) {
  if (level >= MAX_LEVEL) return null
  return Math.max(0, Math.min(QUESTS_PER_LEVEL - 1, bravery - level * QUESTS_PER_LEVEL))
}

function levelLine(level, name) {
  const line = LEVEL_LINES[Math.max(0, Math.min(MAX_LEVEL, level))]
  return line.replace('{name}', name || 'The kitty')
}

// The second half of the name, chosen on the first run.
const TITLES = [
  'the Brave',
  'the Cutest',
  'the Fluffy',
  'the Sleepy',
  'the Curious',
  'the Magnificent',
  'the Tiny',
  'the Mighty',
  'the Snack Thief',
  'the Invisible',
  'the Purrfect',
  'the Wise',
]

function cleanName(raw, max = 60) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// "1.10.0" > "1.9.2". Anything that isn't a version compares as 0.0.0.
function compareVersions(a, b) {
  const parse = (v) =>
    String(v ?? '')
      .replace(/^v/i, '')
      .split('.')
      .map((x) => parseInt(x, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0) ? 1 : -1
  }
  return 0
}

module.exports = {
  todayISO,
  localDayBounds,
  prettyDate,
  normalizeQuests,
  countDone,
  QUESTS_PER_LEVEL,
  MAX_LEVEL,
  LEVEL_LINES,
  levelFor,
  progressFor,
  levelLine,
  TITLES,
  cleanName,
  compareVersions,
}
