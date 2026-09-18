import { useEffect, useRef, useState } from 'react'
import { ADMIN_PASSCODE } from '../lib/adminAccess'

export default function PasscodeGate({ onUnlock, onCancel }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  function handleSubmit(e) {
    e.preventDefault()
    if (value.trim().toLowerCase() === ADMIN_PASSCODE.toLowerCase()) onUnlock()
    else setWrong(true)
  }

  return (
    <section className="view view--gate">
      <form className="gate-form" onSubmit={handleSubmit}>
        <h2 className="gate-form__title">Just a moment</h2>
        <p>This corner is for planning ahead — enter your passcode.</p>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setWrong(false)
          }}
          placeholder="Passcode"
          autoComplete="off"
          aria-label="Passcode"
        />
        {wrong && <p className="view__error">That's not it — try again.</p>}
        <div className="gate-form__actions">
          <button type="submit" className="btn btn--primary">
            Unlock
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Never mind
          </button>
        </div>
      </form>
    </section>
  )
}
