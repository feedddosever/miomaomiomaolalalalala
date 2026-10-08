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

// How brave the kitty is, by the number of quests ever ticked (on the
// website or here). Thresholds are deliberately gentle.
const STAGES = [
  { at: 0, line: '{name} only leaves paw prints so far.' },
  { at: 5, line: '{name} slips past as a shadow now and then.' },
  { at: 15, line: '{name} peeks out sometimes. Keep an eye on the bottom of your screen.' },
  { at: 30, line: '{name} has fully moved in.' },
]

function stageFor(doneCount) {
  let stage = 0
  STAGES.forEach((s, i) => {
    if (doneCount >= s.at) stage = i
  })
  return stage
}

function stageLine(stage, name) {
  const s = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage))]
  return s.line.replace('{name}', name || 'The kitty')
}

function cleanName(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

module.exports = {
  todayISO,
  localDayBounds,
  prettyDate,
  normalizeQuests,
  countDone,
  STAGES,
  stageFor,
  stageLine,
  cleanName,
}
