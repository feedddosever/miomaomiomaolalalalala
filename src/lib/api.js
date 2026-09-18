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

export async function collectTreasure({ date, quests, bonus_type, bonus }) {
  const { data, error } = await supabase
    .from('collected_treasures')
    .insert({
      date,
      quests: quests.map((text) => ({ text, done: false })),
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
