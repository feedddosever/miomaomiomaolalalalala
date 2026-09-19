import { useEffect, useState } from 'react'

// The kitten doesn't settle. It shows up somewhere, watches for a few
// seconds, slips away, and turns up somewhere else -- starting behind the
// chest and then wandering over the quests.
//
// Spot 0 is drawn inside the chest's own SVG (so the chest can hide half
// of it); the rest are an overlay placed by percentage, which keeps them
// sensible on any screen size.
export const CAT_SPOTS = [
  { id: 'chest' },
  { id: 'list-right', top: '40%', left: '86%', from: 'right' },
  { id: 'list-left', top: '66%', left: '10%', from: 'left', flip: true },
  { id: 'list-low', top: '84%', left: '70%', from: 'bottom' },
  { id: 'up-left', top: '22%', left: '14%', from: 'left', flip: true },
]

export const FIRST_MIN_MS = 5000
export const FIRST_MAX_MS = 10000
export const VISIBLE_MS = 5000
export const HIDDEN_MS = 2000

export function useWanderingCat(active) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      setIndex(0)
      return undefined
    }

    let timer
    let at = 0

    function show() {
      setIndex(at)
      setVisible(true)
      timer = window.setTimeout(hideThenMoveOn, VISIBLE_MS)
    }

    function hideThenMoveOn() {
      // Fade out where it stands, then reappear elsewhere.
      setVisible(false)
      timer = window.setTimeout(() => {
        at = (at + 1) % CAT_SPOTS.length
        show()
      }, HIDDEN_MS)
    }

    timer = window.setTimeout(show, FIRST_MIN_MS + Math.random() * (FIRST_MAX_MS - FIRST_MIN_MS))
    return () => window.clearTimeout(timer)
  }, [active])

  return { spot: CAT_SPOTS[index], index, visible }
}
