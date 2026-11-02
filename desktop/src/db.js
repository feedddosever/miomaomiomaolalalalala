// A small client for the same Supabase tables the website uses
// (daily_content, collected_treasures, kitty), talking to PostgREST over
// plain fetch. It runs in the main process, so nothing in the windows
// ever touches the network or the key directly.

const { normalizeQuests } = require('./logic')

const MISSED_DAY_LOOKBACK = 30 // same as the website

class DbError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.status = status
    this.code = code
  }
}

function makeDb({ url, key, timeoutMs = 15000, fetchImpl = globalThis.fetch }) {
  const base = String(url || '').replace(/\/+$/, '') + '/rest/v1/'

  async function req(path, { method = 'GET', body, prefer } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res
    try {
      res = await fetchImpl(base + path, {
        method,
        signal: controller.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (err) {
      throw new DbError(
        err?.name === 'AbortError' ? 'The server took too long to answer.' : "Couldn't reach the server.",
        { code: 'network' }
      )
    } finally {
      clearTimeout(timer)
    }
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      throw new DbError(data?.message || `Request failed (${res.status})`, {
        status: res.status,
        code: data?.code,
      })
    }
    return data
  }

  const q = (v) => encodeURIComponent(v)

  // ---- the kitty ----
  // { name, baselineDone } or null before the kitty has been named.
  async function getKitty() {
    const rows = await req(`kitty?select=name,baseline_done&id=eq.1`)
    const row = rows?.[0]
    return row ? { name: row.name, baselineDone: row.baseline_done ?? 0 } : null
  }

  // baselineDone is only sent the first time: renaming later keeps it.
  async function setKitty(name, baselineDone) {
    const body = { id: 1, name, updated_at: new Date().toISOString() }
    if (Number.isInteger(baselineDone)) body.baseline_done = baselineDone
    const rows = await req(`kitty`, {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body,
    })
    const row = rows?.[0]
    return { name: row?.name ?? name, baselineDone: row?.baseline_done ?? baselineDone ?? 0 }
  }

  // ---- reading the day ----
  async function getCollected(date) {
    const rows = await req(`collected_treasures?select=*&date=eq.${q(date)}`)
    return rows?.[0] ?? null
  }

  async function getPlanned(date) {
    const rows = await req(`daily_content?select=*&date=eq.${q(date)}`)
    return rows?.[0] ?? null
  }

  // The most recent planned day before today that was never opened.
  async function getMissedDay(today) {
    const planned = await req(
      `daily_content?select=*&date=lt.${q(today)}&order=date.desc&limit=${MISSED_DAY_LOOKBACK}`
    )
    if (!planned?.length) return null
    const list = planned.map((r) => r.date).join(',')
    const opened = await req(`collected_treasures?select=date&date=in.(${q(list)})`)
    const seen = new Set((opened ?? []).map((r) => r.date))
    return planned.find((r) => !seen.has(r.date)) ?? null
  }

  async function getOpenedToday({ start, end }) {
    const rows = await req(
      `collected_treasures?select=*&opened_at=gte.${q(start)}&opened_at=lt.${q(end)}&order=opened_at.desc&limit=1`
    )
    return rows?.[0] ?? null
  }

  /**
   * What the Today tab on the website would show right now, in the same
   * order: today's opened chest, today's planned chest, the most recent
   * day that was never opened, or a missed chest already opened today.
   */
  async function loadDay({ today, bounds }) {
    const collected = await getCollected(today)
    if (collected) return { kind: 'open', treasure: collected }
    const planned = await getPlanned(today)
    if (planned) return { kind: 'closed', planned }
    const missed = await getMissedDay(today)
    if (missed) return { kind: 'closed', planned: missed }
    const openedToday = await getOpenedToday(bounds)
    if (openedToday) return { kind: 'open', treasure: openedToday }
    return { kind: 'empty' }
  }

  // ---- writing ----
  async function openChest(planned) {
    try {
      const rows = await req(`collected_treasures`, {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          date: planned.date,
          quests: normalizeQuests(planned.quests).map(({ text }) => ({ text, done: false })),
          bonus_type: planned.bonus_type,
          bonus: planned.bonus,
        },
      })
      return rows?.[0]
    } catch (err) {
      // Already opened, on the website or a second ago here. Use that one.
      if (err.code === '23505' || err.status === 409) {
        const existing = await getCollected(planned.date)
        if (existing) return existing
      }
      throw err
    }
  }

  // Reads the row fresh before writing, so a tick made on the website a
  // minute ago isn't overwritten by an older copy held here.
  async function toggleQuest(date, index) {
    const row = await getCollected(date)
    if (!row) throw new DbError("That chest isn't open any more.")
    const quests = normalizeQuests(row.quests)
    if (!quests[index]) throw new DbError('That quest has changed. Refreshing.')
    quests[index] = { ...quests[index], done: !quests[index].done }
    const saved = await req(`collected_treasures?date=eq.${q(date)}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { quests },
    })
    return saved?.[0] ?? { ...row, quests }
  }

  async function allTreasureQuests() {
    return (await req(`collected_treasures?select=quests`)) ?? []
  }

  return {
    getKitty,
    setKitty,
    loadDay,
    openChest,
    toggleQuest,
    allTreasureQuests,
  }
}

module.exports = { makeDb, DbError }
