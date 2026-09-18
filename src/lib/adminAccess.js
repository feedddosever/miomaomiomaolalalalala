import { useCallback, useEffect, useRef, useState } from 'react'

// The planner is hidden from the normal app. Getting to it needs the
// passcode, which can arrive three ways so it works on a keyboard and on
// a phone alike:
//
//   1. Type the passcode anywhere on the page (desktop).
//   2. Add #plan to the URL, then enter the passcode (works anywhere,
//      and can be bookmarked).
//   3. Tap the little ears in the header five times, then enter the
//      passcode (for phones, where there's nothing to type into).
//
// This keeps the planner out of sight. It is NOT a security boundary:
// the Supabase anon key ships in the page like it does in any browser-only
// app, so anyone determined could still write to the tables directly. See
// the README for the auth-based upgrade if that ever matters.

const RAW_PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE
const TRIMMED = typeof RAW_PASSCODE === 'string' ? RAW_PASSCODE.trim() : ''

export const ADMIN_PASSCODE = TRIMMED || 'meow'
export const USING_DEFAULT_PASSCODE = TRIMMED === ''

const STORE_KEY = 'daily-chest-planner-unlocked'
const PLAN_HASH = '#plan'
const TAPS_TO_PROMPT = 5
const TAP_TIMEOUT_MS = 1500

// sessionStorage throws in some privacy modes, so never let it break the app.
function readStored() {
  try {
    return window.sessionStorage.getItem(STORE_KEY) === 'yes'
  } catch {
    return false
  }
}

function writeStored(value) {
  try {
    if (value) window.sessionStorage.setItem(STORE_KEY, 'yes')
    else window.sessionStorage.removeItem(STORE_KEY)
  } catch {
    /* not worth surfacing -- the unlock just won't survive a reload */
  }
}

function clearPlanHash() {
  if (window.location.hash.toLowerCase() !== PLAN_HASH) return
  const clean = window.location.pathname + window.location.search
  window.history.replaceState(null, '', clean)
}

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useAdminAccess() {
  const [unlocked, setUnlocked] = useState(readStored)
  const [prompting, setPrompting] = useState(false)
  const taps = useRef({ count: 0, last: 0 })

  const unlock = useCallback(() => {
    writeStored(true)
    clearPlanHash()
    setPrompting(false)
    setUnlocked(true)
  }, [])

  const lock = useCallback(() => {
    writeStored(false)
    clearPlanHash()
    taps.current = { count: 0, last: 0 }
    setPrompting(false)
    setUnlocked(false)
  }, [])

  const closePrompt = useCallback(() => {
    clearPlanHash()
    setPrompting(false)
  }, [])

  // 1. typing the passcode anywhere on the page
  useEffect(() => {
    if (unlocked) return undefined
    let buffer = ''
    function onKeyDown(e) {
      // Ignore modified keys and anything typed into a real field.
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      buffer = (buffer + e.key).slice(-ADMIN_PASSCODE.length)
      if (buffer.toLowerCase() === ADMIN_PASSCODE.toLowerCase()) {
        buffer = ''
        unlock()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [unlocked, unlock])

  // 2. #plan in the URL opens the passcode prompt
  useEffect(() => {
    if (unlocked) return undefined
    function check() {
      if (window.location.hash.toLowerCase() === PLAN_HASH) setPrompting(true)
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [unlocked])

  // 3. five quick taps on the header mark
  const registerTap = useCallback(() => {
    if (unlocked) return
    const now = Date.now()
    const fresh = now - taps.current.last < TAP_TIMEOUT_MS
    const count = fresh ? taps.current.count + 1 : 1
    taps.current = { count, last: now }
    if (count >= TAPS_TO_PROMPT) {
      taps.current = { count: 0, last: 0 }
      setPrompting(true)
    }
  }, [unlocked])

  return { unlocked, prompting, unlock, lock, closePrompt, registerTap }
}
