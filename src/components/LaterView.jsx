import { useEffect, useRef, useState } from 'react'
import QuestList from './QuestList'
import {
  collectTreasure,
  getAllCollectedTreasures,
  getCollectedTreasure,
  getUnopenedDays,
  normalizeQuests,
  updateCollectedQuests,
} from '../lib/api'
import { todayISO, toPretty, toShort } from '../lib/date'
import { friendlyError } from '../lib/errors'

/**
 * Every quest from an earlier day that was never ticked, gathered in one
 * place. Today's chest isn't included -- its quests are still today's, on
 * the Today tab -- but anything left unticked moves here once the day is
 * over.
 *
 * That includes days whose chest was never opened at all: their quests
 * wait here too, and the first tick on one opens that day's chest (so its
 * recipe lands in My Treasures as well).
 */
export default function LaterView() {
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Which quests this visit shows: the ones still unticked when the tab
  // opened, grouped by day. The list is held still while you're here, so
  // a quest you tick stays in place with its paw filled in (and can be
  // unticked if the tap was a slip) instead of vanishing under your
  // thumb. Next time you come back, it's gone.
  const [days, setDays] = useState([]) // [{ date, indexes }]
  const [questsByDate, setQuestsByDate] = useState(() => new Map())

  // Newest quest array per date, updated synchronously on click, so two
  // quick ticks on the same day chain instead of the second overwriting
  // the first. (Same idea as in TodayView and TreasuresView.)
  const latest = useRef(new Map())

  // Days shown here whose chest hasn't been opened yet (date -> planned
  // row), and the open in flight for a day, so two quick ticks on the same
  // unopened day open its chest once and both wait for it.
  const unopened = useRef(new Map())
  const opening = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadFailed(false)
      setError(null)
      try {
        const today = todayISO()
        const [rows, missed] = await Promise.all([
          getAllCollectedTreasures(),
          getUnopenedDays(today),
        ])
        if (cancelled) return
        const byDate = new Map()
        const waiting = []
        const consider = (date, quests) => {
          byDate.set(date, quests)
          const indexes = []
          quests.forEach((q, i) => {
            if (!q.done && q.text) indexes.push(i)
          })
          if (indexes.length > 0) waiting.push({ date, indexes })
        }
        for (const row of rows) {
          if (row.date < today) consider(row.date, normalizeQuests(row.quests))
        }
        unopened.current = new Map()
        for (const row of missed) {
          if (byDate.has(row.date)) continue // opened in the meantime
          unopened.current.set(row.date, row)
          consider(row.date, normalizeQuests(row.quests))
        }
        waiting.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        latest.current = byDate
        setQuestsByDate(new Map(byDate))
        setDays(waiting)
      } catch (err) {
        if (!cancelled) {
          setError(friendlyError(err, 'Could not load your quests.'))
          setLoadFailed(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Opens a day's chest the first time one of its quests is ticked here.
  // Resolves to null once we've opened it, or to the existing row if it
  // was opened somewhere else first (the Today tab, another device).
  function openDay(date) {
    let pending = opening.current.get(date)
    if (!pending) {
      const planned = unopened.current.get(date)
      pending = collectTreasure({
        date,
        quests: planned.quests,
        bonus_type: planned.bonus_type,
        bonus: planned.bonus,
      })
        .then(() => null)
        .catch((err) => {
          // 23505 = this day already has a row: it was opened elsewhere.
          if (err?.code !== '23505') throw err
          return getCollectedTreasure(date)
        })
        .then((existing) => {
          unopened.current.delete(date)
          return existing
        })
        .finally(() => opening.current.delete(date))
      opening.current.set(date, pending)
    }
    return pending
  }

  async function handleToggle(date, index) {
    const base = latest.current.get(date)
    if (!base) return
    const next = base.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    latest.current.set(date, next)
    setQuestsByDate((prev) => new Map(prev).set(date, next))
    setError(null)
    try {
      if (unopened.current.has(date)) {
        const existing = await openDay(date)
        if (existing) {
          // Keep any ticks made wherever the chest was opened, too.
          const merged = mergeTicks(latest.current.get(date), normalizeQuests(existing.quests))
          latest.current.set(date, merged)
          setQuestsByDate((prev) => new Map(prev).set(date, merged))
        }
        await updateCollectedQuests(date, latest.current.get(date))
      } else {
        await updateCollectedQuests(date, next)
      }
    } catch (err) {
      setError(friendlyError(err, 'Could not save that check-off.'))
    }
  }

  if (loading) {
    return (
      <section className="view view--later">
        <p className="view__loading">Looking for quests that are still waiting…</p>
      </section>
    )
  }

  if (loadFailed) {
    return (
      <section className="view view--later">
        <div className="load-failed">
          <p className="view__error">{error}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (days.length === 0) {
    return (
      <section className="view view--later">
        <p className="view__note">
          {questsByDate.size > 0
            ? 'Nothing waiting — every quest from earlier days has its paw print :3'
            : "Nothing here yet. Quests you don't get to on the day will wait here for you."}
        </p>
      </section>
    )
  }

  const thisYear = todayISO().slice(0, 4)

  return (
    <section className="view view--later">
      <p className="view__note">
        Quests from earlier days that haven't been ticked yet. No rush — they'll wait here.
      </p>

      {error && <p className="view__error">{error}</p>}

      <ul className="later-list">
        {days.map(({ date, indexes }) => {
          const quests = questsByDate.get(date) ?? []
          return (
            <li key={date} className="later-day">
              <h2 className="later-day__date">
                {date.startsWith(thisYear) ? toPretty(date) : toShort(date)}
              </h2>
              <QuestList
                quests={indexes.map((i) => quests[i])}
                onToggle={(n) => handleToggle(date, indexes[n])}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Our quests with any tick from `theirs` added, when both lists hold the
// same quests. If they don't match (the day was edited meanwhile), ours
// stand as they are.
function mergeTicks(ours, theirs) {
  if (ours.length !== theirs.length) return ours
  if (ours.some((q, i) => q.text !== theirs[i].text)) return ours
  return ours.map((q, i) => (theirs[i].done && !q.done ? { ...q, done: true } : q))
}
