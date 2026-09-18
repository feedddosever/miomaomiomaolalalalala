import { useEffect, useState } from 'react'
import QuestList from './QuestList'
import BonusCard from './BonusCard'
import PawMark from './PawMark'
import { getAllCollectedTreasures, updateCollectedQuests } from '../lib/api'
import { toShort } from '../lib/date'

export default function TreasuresView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [treasures, setTreasures] = useState([])
  const [openDate, setOpenDate] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await getAllCollectedTreasures()
        if (!cancelled) setTreasures(rows)
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Could not load your treasures.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggleQuest(date, index) {
    setTreasures((prev) =>
      prev.map((t) =>
        t.date !== date
          ? t
          : { ...t, quests: t.quests.map((q, i) => (i === index ? { ...q, done: !q.done } : q)) }
      )
    )
    const row = treasures.find((t) => t.date === date)
    if (!row) return
    const nextQuests = row.quests.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    try {
      await updateCollectedQuests(date, nextQuests)
    } catch (err) {
      setError(err.message ?? 'Could not save that check-off.')
    }
  }

  if (loading) return <p className="view__loading">Gathering your treasures…</p>
  if (error) return <p className="view__error">{error}</p>

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
            <li key={t.date} className="treasure-shelf__item">
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
