import { useEffect, useRef, useState } from 'react'
import QuestList from './QuestList'
import BonusCard from './BonusCard'
import PawMark from './PawMark'
import { getAllCollectedTreasures, updateCollectedQuests } from '../lib/api'
import { toShort } from '../lib/date'
import { friendlyError } from '../lib/errors'

export default function TreasuresView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [treasures, setTreasures] = useState([])
  const [openDate, setOpenDate] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Newest quest array per date, updated synchronously on click, so two
  // quick ticks on the same day don't both read the same stale row and
  // undo one another. (See the matching note in TodayView.)
  const questsByDate = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await getAllCollectedTreasures()
        if (cancelled) return
        questsByDate.current = new Map(rows.map((r) => [r.date, r.quests]))
        setTreasures(rows)
      } catch (err) {
        if (!cancelled) setError(friendlyError(err, 'Could not load your treasures.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function handleToggleQuest(date, index) {
    const base = questsByDate.current.get(date)
    if (!base) return
    const nextQuests = base.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    questsByDate.current.set(date, nextQuests)
    setTreasures((prev) => prev.map((t) => (t.date === date ? { ...t, quests: nextQuests } : t)))
    try {
      await updateCollectedQuests(date, nextQuests)
    } catch (err) {
      setError(friendlyError(err, 'Could not save that check-off.'))
    }
  }

  if (loading) {
    return (
      <section className="view view--treasures">
        <p className="view__loading">Gathering your treasures…</p>
      </section>
    )
  }

  if (error && treasures.length === 0) {
    return (
      <section className="view view--treasures">
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

  if (treasures.length === 0) {
    return (
      <section className="view view--treasures">
        <p className="view__note">Nothing collected yet — open today's chest to start your stash.</p>
      </section>
    )
  }

  return (
    <section className="view view--treasures">
      <ul className="treasure-shelf">
        {treasures.map((t) => {
          const isOpen = openDate === t.date
          const doneCount = t.quests.filter((q) => q.done).length
          return (
            <li
              key={t.date}
              className={`treasure-shelf__item ${
                isOpen ? 'treasure-shelf__item--open' : ''
              }`}
            >
              <button
                type="button"
                className="treasure-badge"
                onClick={() => setOpenDate(isOpen ? null : t.date)}
                aria-expanded={isOpen}
              >
                <PawMark filled />
                <span className="treasure-badge__date">{toShort(t.date)}</span>
                <span className="treasure-badge__count">
                  {doneCount}/{t.quests.length} done
                </span>
              </button>

              {isOpen && (
                <div className="reveal reveal--compact">
                  <QuestList
                    quests={t.quests}
                    onToggle={(i) => handleToggleQuest(t.date, i)}
                  />
                  <BonusCard type={t.bonus_type} bonus={t.bonus} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
