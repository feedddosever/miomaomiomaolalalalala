import { useEffect, useRef, useState } from 'react'
import Chest from './Chest'
import QuestList from './QuestList'
import BonusCard from './BonusCard'
import RoamingCat from './RoamingCat'
import {
  getDailyContent,
  getCollectedTreasure,
  getMissedDay,
  getTreasureOpenedToday,
  collectTreasure,
  updateCollectedQuests,
} from '../lib/api'
import { todayISO, toPretty, localDayBounds } from '../lib/date'
import { friendlyError } from '../lib/errors'
import { useWanderingCat } from '../lib/useWanderingCat'

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

  const today = todayISO()

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
        const already = await getCollectedTreasure(today)
        if (cancelled) return
        if (already) {
          adopt(already)
        } else {
          const content = await getDailyContent(today)
          if (cancelled) return
          if (content) {
            setPlanned(content)
          } else {
            // Nothing for today -- offer the most recent day you never got
            // round to opening, rather than leaving it stranded forever.
            const missed = await getMissedDay(today)
            if (cancelled) return
            if (missed) {
              setPlanned(missed)
            } else {
              // Nothing missed either. If a chest was opened earlier today
              // (a missed day you already collected), keep showing it --
              // otherwise it would disappear from Today on the next reload.
              const openedToday = await getTreasureOpenedToday(localDayBounds())
              if (!cancelled && openedToday) adopt(openedToday)
            }
          }
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
  }, [today, reloadKey])

  async function handleOpen() {
    if (!planned || treasure) return
    try {
      const saved = await collectTreasure({
        // A missed day is collected under its own date, not today's.
        date: planned.date,
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
          const existing = await getCollectedTreasure(planned.date)
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
    const target = treasure?.date
    if (!target) return
    const nextQuests = base.map((q, i) => (i === index ? { ...q, done: !q.done } : q))
    questsRef.current = nextQuests
    setTreasure((prev) => (prev ? { ...prev, quests: nextQuests } : prev))
    try {
      await updateCollectedQuests(target, nextQuests)
    } catch (err) {
      setError(friendlyError(err, 'Could not save that check-off.'))
    }
  }

  let status = 'empty'
  if (treasure) status = 'open'
  else if (planned) status = 'closed'

  // Which day the chest on screen actually belongs to. Usually today, but
  // it can be an older planned day that was never opened.
  const activeDate = treasure?.date ?? planned?.date ?? today
  const isMissed = activeDate !== today

  // Once the chest is open the kitten starts doing the rounds: behind the
  // chest first, then over the quests, turning up somewhere new each time.
  const cat = useWanderingCat(status === 'open')

  return (
    <section className="view view--today">
      <p className="view__eyebrow">{toPretty(today)}</p>

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
            {isMissed && (
              <p className="missed-note">
                {status === 'open' ? 'From' : 'Still waiting from'} {toPretty(activeDate)}
              </p>
            )}

            <Chest
              status={status}
              onOpen={handleOpen}
              missed={isMissed}
              catPeeking={cat.visible && cat.index === 0}
            />

            {error && <p className="view__error">{error}</p>}

            {/* No pointer to the planner here -- visitors can't see it. */}
            {status === 'empty' && !error && (
              <p className="view__note">Nothing's been planned for today yet.</p>
            )}
          </div>

          {treasure && (
            <div className="today-layout__panel">
              <div className="reveal">
                <h2 className="reveal__title">{isMissed ? 'Quests' : "Today's quests"}</h2>
                <QuestList quests={treasure.quests} onToggle={handleToggleQuest} />
                <BonusCard type={treasure.bonus_type} bonus={treasure.bonus} />
              </div>
            </div>
          )}
        </div>
      )}

      {cat.index > 0 && <RoamingCat spot={cat.spot} visible={cat.visible} />}
    </section>
  )
}
