import { useEffect, useState } from 'react'
import Chest from './Chest'
import QuestList from './QuestList'
import BonusCard from './BonusCard'
import { getDailyContent, getCollectedTreasure, collectTreasure, updateCollectedQuests } from '../lib/api'
import { todayISO, toPretty } from '../lib/date'

export default function TodayView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [planned, setPlanned] = useState(null) // row from daily_content, if any
  const [treasure, setTreasure] = useState(null) // row from collected_treasures, once opened

  const date = todayISO()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const already = await getCollectedTreasure(date)
        if (cancelled) return
        if (already) {
          setTreasure(already)
        } else {
          const content = await getDailyContent(date)
          if (!cancelled) setPlanned(content)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Something went wrong loading today.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [date])

  async function handleOpen() {
    if (!planned) return
    try {
      const saved = await collectTreasure({
        date,
        quests: planned.quests,
        bonus_type: planned.bonus_type,
        bonus: planned.bonus,
      })
      setTreasure(saved)
    } catch (err) {
      setError(err.message ?? 'Could not open the chest just now.')
    }
  }

  async function handleToggleQuest(index) {
    if (!treasure) return
    const nextQuests = treasure.quests.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    setTreasure({ ...treasure, quests: nextQuests })
    try {
      await updateCollectedQuests(date, nextQuests)
    } catch (err) {
      setError(err.message ?? 'Could not save that check-off.')
    }
  }

  let status = 'empty'
  if (treasure) status = 'open'
  else if (planned) status = 'closed'

  return (
    <section className="view view--today">
      <p className="view__eyebrow">{toPretty(date)}</p>

      {loading ? (
        <p className="view__loading">Loading today's chest…</p>
      ) : (
        /* One column on phones; on wide screens the chest sits beside the
           quests instead of pushing them below the fold (see .today-layout). */
        <div className="today-layout">
          <div className="today-layout__chest">
            <Chest status={status} onOpen={handleOpen} />

            {error && <p className="view__error">{error}</p>}

            {status === 'empty' && !error && (
              <p className="view__note">
                You haven't planned anything for today yet — add it from the{' '}
                <em>Plan Ahead</em> tab.
              </p>
            )}
          </div>

          {treasure && (
            <div className="today-layout__panel">
              <div className="reveal">
                <h2 className="reveal__title">Today's quests</h2>
                <QuestList quests={treasure.quests} onToggle={handleToggleQuest} />
                <BonusCard type={treasure.bonus_type} bonus={treasure.bonus} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
