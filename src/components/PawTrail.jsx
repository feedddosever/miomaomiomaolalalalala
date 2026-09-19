// A line of paw prints that fades in one after another, as if an invisible
// cat had just padded across the page. Purely decorative: it sits behind
// everything, ignores pointer events, and is hidden from screen readers.

const STEPS = 9

// Walk diagonally from the lower left to the upper right, offsetting each
// print to alternate sides the way a real cat's gait does.
const PAWS = Array.from({ length: STEPS }, (_, i) => {
  const t = i / (STEPS - 1)
  const side = i % 2 === 0 ? -1 : 1
  return {
    i,
    left: 8 + t * 78 + side * 1.4,
    top: 86 - t * 70 + side * 1.6,
    rot: -34 + t * 46 + side * 7,
  }
})

export default function PawTrail() {
  return (
    <div className="paw-trail" aria-hidden="true">
      {PAWS.map(({ i, left, top, rot }) => (
        <svg
          key={i}
          className="paw-trail__paw"
          viewBox="0 0 32 32"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            '--paw-rot': `${rot}deg`,
            '--paw-step': i,
          }}
        >
          <ellipse cx="16" cy="20" rx="9" ry="7.5" />
          <ellipse cx="6.5" cy="11.5" rx="3.4" ry="4.2" transform="rotate(-18 6.5 11.5)" />
          <ellipse cx="14" cy="6.5" rx="3.4" ry="4.4" transform="rotate(-4 14 6.5)" />
          <ellipse cx="22" cy="6.8" rx="3.4" ry="4.4" transform="rotate(8 22 6.8)" />
          <ellipse cx="27" cy="12.5" rx="3.2" ry="4" transform="rotate(22 27 12.5)" />
        </svg>
      ))}
    </div>
  )
}
