import { useEffect, useRef, useState } from 'react'
import Chest from './Chest'
import QuestList from './QuestList'
import BonusCard from './BonusCard'
import { getDailyContent, getCollectedTreasure, collectTreasure, updateCollectedQuests } from '../lib/api'
import { todayISO, toPretty } from '../lib/date'
import { friendlyError } from '../lib/errors'

export default function TodayView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Tracked apart from `error`: if the first load failed we know nothing
  // about today, so showing a dim "nothing planned" chest would be a lie.
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [planned, setPlanned] = useState(null) // row from daily_content, if any
  const [treasure, setTreasure] = useState(null) // row from collected_treasures, once opened

  // Two quick taps on different quests used to race: both read the same
  // pre-render `treasure`, so the second write clobbered the first. This
  // ref always holds the newest quest array, updated synchronously on
  // click, so rapid ticks chain instead of overwriting each other.
  const questsRef = useRef(null)

  const date = todayISO()

  function adopt(row) {
    questsRef.current = row?.quests ?? null
    setTreasure(row)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setLoadFailed(false)
      try {
        const already = await getCollectedTreasure(date)
        if (cancelled) return
        if (already) {
          adopt(already)
        } else {
          const content = await getDailyContent(date)
          if (!cancelled) setPlanned(content)
        }
      } catch (err) {
        if (!cancelled) {
          setError(friendlyError(err, 'Something went wrong loading today.'))
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
  }, [date, reloadKey])

  async function handleOpen() {
    if (!planned || treasure) return
    try {
      const saved = await collectTreasure({
        date,
        quests: planned.quests,
        bonus_type: planned.bonus_type,
        bonus: planned.bonus,
      })
      adopt(saved)
    } catch (err) {
      // 23505 = today's row already exists, e.g. the chest was opened in
      // another tab. Show that chest rather than an error.
      if (err?.code === '23505') {
        try {
          const existing = await getCollectedTreasure(date)
          if (existing) return adopt(existing)
        } catch {
          /* fall through to the message below */
        }
      }
      setError(friendlyError(err, 'Could not open the chest just now.'))
    }
  }

  async function handleToggleQuest(index) {
    const base = questsRef.current
    if (!base) return
    const nextQuests = base.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    questsRef.current = nextQuests
    setTreasure((prev) => (prev ? { ...prev, quests: nextQuests } : prev))
    try {
      await updateCollectedQuests(date, nextQuests)
    } catch (err) {
      setError(friendlyError(err, 'Could not save that check-off.'))
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
      ) : loadFailed ? (
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
      ) : (
        /* One column on phones; on wide screens the chest sits beside the
           quests instead of pushing them below the fold (see .today-layout). */
        <div className="today-layout">
          <div className="today-layout__chest">
            <Chest status={status} onOpen={handleOpen} />

            {error && <p className="view__error">{error}</p>}

            {/* No pointer to the planner here -- visitors can't see it. */}
            {status === 'empty' && !error && (
              <p className="view__note">Nothing's been planned for today yet.</p>
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
