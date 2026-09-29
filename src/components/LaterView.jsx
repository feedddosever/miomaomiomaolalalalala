import { useEffect, useRef, useState } from 'react'
import QuestList from './QuestList'
import { getAllCollectedTreasures, normalizeQuests, updateCollectedQuests } from '../lib/api'
import { todayISO, toPretty, toShort } from '../lib/date'
import { friendlyError } from '../lib/errors'

/**
 * Every quest from an earlier day that was never ticked, gathered in one
 * place. Today's chest isn't included -- its quests are still today's, on
 * the Today tab -- but anything left unticked moves here once the day is
 * over.
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadFailed(false)
      setError(null)
      try {
        const rows = await getAllCollectedTreasures() // newest first
        if (cancelled) return
        const today = todayISO()
        const byDate = new Map()
        const waiting = []
        for (const row of rows) {
          if (!(row.date < today)) continue
          const quests = normalizeQuests(row.quests)
          byDate.set(row.date, quests)
          const indexes = []
          quests.forEach((q, i) => {
            if (!q.done && q.text) indexes.push(i)
          })
          if (indexes.length > 0) waiting.push({ date: row.date, indexes })
        }
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

  async function handleToggle(date, index) {
    const base = latest.current.get(date)
    if (!base) return
    const next = base.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    latest.current.set(date, next)
    setQuestsByDate((prev) => new Map(prev).set(date, next))
    setError(null)
    try {
      await updateCollectedQuests(date, next)
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
