import { useEffect, useMemo, useState } from 'react'
import { getAllDailyContent, upsertDailyContent, deleteDailyContent } from '../lib/api'
import { toShort, todayISO } from '../lib/date'

const ADMIN_PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE
const GATE_KEY = 'daily-chest-plan-unlocked'

const emptyForm = {
  date: '',
  questLines: ['', '', ''],
  bonusType: 'recipe',
  recipeTitle: '',
  recipeIngredients: '',
  recipeInstructions: '',
  igUrl: '',
  igCaption: '',
}

function entryToForm(entry) {
  const bonus = entry.bonus ?? {}
  return {
    date: entry.date,
    questLines: entry.quests?.length ? entry.quests : [''],
    bonusType: entry.bonus_type,
    recipeTitle: bonus.title ?? '',
    recipeIngredients: (bonus.ingredients ?? []).join('\n'),
    recipeInstructions: (bonus.instructions ?? []).join('\n'),
    igUrl: bonus.url ?? '',
    igCaption: bonus.caption ?? '',
  }
}

function formToEntry(form) {
  const quests = form.questLines.map((q) => q.trim()).filter(Boolean)
  const bonus =
    form.bonusType === 'recipe'
      ? {
          title: form.recipeTitle.trim(),
          ingredients: form.recipeIngredients.split('\n').map((s) => s.trim()).filter(Boolean),
          instructions: form.recipeInstructions.split('\n').map((s) => s.trim()).filter(Boolean),
        }
      : {
          url: form.igUrl.trim(),
          caption: form.igCaption.trim(),
        }
  return {
    date: form.date,
    quests,
    bonus_type: form.bonusType,
    bonus,
  }
}

export default function PlanAheadView() {
  const [unlocked, setUnlocked] = useState(
    !ADMIN_PASSCODE || sessionStorage.getItem(GATE_KEY) === 'yes'
  )
  const [passInput, setPassInput] = useState('')
  const [passError, setPassError] = useState(false)

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...emptyForm, date: todayISO() })

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAllDailyContent()
      setEntries(rows)
    } catch (err) {
      setError(err.message ?? 'Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (unlocked) refresh()
  }, [unlocked])

  const upcoming = useMemo(() => entries.slice().reverse(), [entries])

  function handleUnlock(e) {
    e.preventDefault()
    if (passInput === ADMIN_PASSCODE) {
      sessionStorage.setItem(GATE_KEY, 'yes')
      setUnlocked(true)
    } else {
      setPassError(true)
    }
  }

  function updateQuestLine(i, value) {
    setForm((f) => ({
      ...f,
      questLines: f.questLines.map((q, idx) => (idx === i ? value : q)),
    }))
  }

  function addQuestLine() {
    setForm((f) => ({ ...f, questLines: [...f.questLines, ''] }))
  }

  function removeQuestLine(i) {
    setForm((f) => ({ ...f, questLines: f.questLines.filter((_, idx) => idx !== i) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const entry = formToEntry(form)
    if (!entry.date) return setError('Pick a date.')
    if (entry.quests.length === 0) return setError('Add at least one quest.')
    if (entry.bonus_type === 'recipe' && !entry.bonus.title) return setError('Give the recipe a title.')
    if (entry.bonus_type === 'instagram' && !entry.bonus.url) return setError('Add the Instagram link.')

    setSaving(true)
    try {
      await upsertDailyContent(entry)
      await refresh()
      setForm({ ...emptyForm, date: todayISO() })
    } catch (err) {
      setError(err.message ?? 'Could not save that day.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(date) {
    setError(null)
    try {
      await deleteDailyContent(date)
      await refresh()
    } catch (err) {
      setError(err.message ?? 'Could not delete that day.')
    }
  }

  function handleEdit(entry) {
    setForm(entryToForm(entry))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!unlocked) {
    return (
      <section className="view view--plan-gate">
        <form className="gate-form" onSubmit={handleUnlock}>
          <p>This corner is just for planning ahead — enter your passcode.</p>
          <input
            type="password"
            value={passInput}
            onChange={(e) => {
              setPassInput(e.target.value)
              setPassError(false)
            }}
            placeholder="Passcode"
          />
          {passError && <p className="view__error">That's not it — try again.</p>}
          <button type="submit" className="btn btn--primary">
            Unlock
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="view view--plan">
      <form className="plan-form" onSubmit={handleSubmit}>
        <h2 className="plan-form__title">
          {entries.some((en) => en.date === form.date) ? 'Edit a day' : 'Plan a day'}
        </h2>

        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
        </label>

        <div className="field">
          <span>Quests</span>
          {form.questLines.map((line, i) => (
            <div className="quest-input-row" key={i}>
              <input
                type="text"
                value={line}
                onChange={(e) => updateQuestLine(i, e.target.value)}
                placeholder={`Quest ${i + 1}`}
              />
              {form.questLines.length > 1 && (
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => removeQuestLine(i)}
                  aria-label="Remove this quest"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--small" onClick={addQuestLine}>
            + Add another quest
          </button>
        </div>

        <div className="field">
          <span>Bonus</span>
          <div className="bonus-toggle">
            <label>
              <input
                type="radio"
                name="bonusType"
                checked={form.bonusType === 'recipe'}
                onChange={() => setForm((f) => ({ ...f, bonusType: 'recipe' }))}
              />
              Recipe
            </label>
            <label>
              <input
                type="radio"
                name="bonusType"
                checked={form.bonusType === 'instagram'}
                onChange={() => setForm((f) => ({ ...f, bonusType: 'instagram' }))}
              />
              Instagram link
            </label>
          </div>
        </div>

        {form.bonusType === 'recipe' ? (
          <>
            <label className="field">
              <span>Recipe title</span>
              <input
                type="text"
                value={form.recipeTitle}
                onChange={(e) => setForm((f) => ({ ...f, recipeTitle: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Ingredients (one per line)</span>
              <textarea
                rows={4}
                value={form.recipeIngredients}
                onChange={(e) => setForm((f) => ({ ...f, recipeIngredients: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Steps (one per line)</span>
              <textarea
                rows={4}
                value={form.recipeInstructions}
                onChange={(e) => setForm((f) => ({ ...f, recipeInstructions: e.target.value }))}
              />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Instagram URL</span>
              <input
                type="url"
                value={form.igUrl}
                onChange={(e) => setForm((f) => ({ ...f, igUrl: e.target.value }))}
                placeholder="https://instagram.com/..."
              />
            </label>
            <label className="field">
              <span>Caption (optional)</span>
              <input
                type="text"
                value={form.igCaption}
                onChange={(e) => setForm((f) => ({ ...f, igCaption: e.target.value }))}
              />
            </label>
          </>
        )}

        {error && <p className="view__error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save this day'}
        </button>
      </form>

      <div className="plan-list">
        <h2 className="plan-list__title">Planned days</h2>
        {loading ? (
          <p className="view__loading">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="view__note">No days planned yet.</p>
        ) : (
          <ul>
            {upcoming.map((entry) => (
              <li key={entry.date} className="plan-list__row">
                <span className="plan-list__date">{toShort(entry.date)}</span>
                <span className="plan-list__meta">
                  {entry.quests.length} quest{entry.quests.length === 1 ? '' : 's'} ·{' '}
                  {entry.bonus_type === 'recipe' ? 'recipe' : 'Instagram'}
                </span>
                <span className="plan-list__actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => handleEdit(entry)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => handleDelete(entry.date)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
