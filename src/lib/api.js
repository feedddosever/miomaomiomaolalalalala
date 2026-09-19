import { supabase } from './supabaseClient'

// ---- daily_content: the planned calendar (quests + bonus per date) ----

export async function getDailyContent(date) {
  const { data, error } = await supabase
    .from('daily_content')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getAllDailyContent() {
  const { data, error } = await supabase
    .from('daily_content')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertDailyContent(entry) {
  const { data, error } = await supabase
    .from('daily_content')
    .upsert(entry, { onConflict: 'date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDailyContent(date) {
  const { error } = await supabase.from('daily_content').delete().eq('date', date)
  if (error) throw error
}

// How far back to look for a chest you never got round to opening. Older
// than this and it's history, not a chest that's still waiting.
const MISSED_DAY_LOOKBACK = 30

/**
 * The most recent planned day before `today` that was never opened, or
 * null. Lets a day you missed still be collected instead of being
 * stranded in the calendar forever.
 */
export async function getMissedDay(today) {
  const { data: planned, error } = await supabase
    .from('daily_content')
    .select('*')
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(MISSED_DAY_LOOKBACK)
  if (error) throw error
  if (!planned?.length) return null

  const { data: collected, error: collectedError } = await supabase
    .from('collected_treasures')
    .select('date')
    .in('date', planned.map((row) => row.date))
  if (collectedError) throw collectedError

  const opened = new Set((collected ?? []).map((row) => row.date))
  return planned.find((row) => !opened.has(row.date)) ?? null
}

// ---- collected_treasures: what's actually been opened + saved ----

export async function getCollectedTreasure(date) {
  const { data, error } = await supabase
    .from('collected_treasures')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getAllCollectedTreasures() {
  const { data, error } = await supabase
    .from('collected_treasures')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

// daily_content.quests holds plain strings, but a row hand-edited in the
// Supabase dashboard could already hold {text, done} objects. Accept both
// rather than writing a treasure whose text is an object.
function toQuestRows(quests) {
  return (quests ?? []).map((q) =>
    typeof q === 'string'
      ? { text: q, done: false }
      : { text: q?.text ?? String(q), done: Boolean(q?.done) }
  )
}

export async function collectTreasure({ date, quests, bonus_type, bonus }) {
  const { data, error } = await supabase
    .from('collected_treasures')
    .insert({
      date,
      quests: toQuestRows(quests),
      bonus_type,
      bonus,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCollectedQuests(date, quests) {
  const { error } = await supabase
    .from('collected_treasures')
    .update({ quests })
    .eq('date', date)
  if (error) throw error
}
