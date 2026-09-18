import { useEffect, useRef, useState } from 'react'

/**
 * status: 'empty'  -> nothing planned for this date, chest is dim & inert
 *         'closed' -> content is waiting, chest is tappable
 *         'open'   -> already opened, lid stays up
 */
export default function Chest({ status, onOpen }) {
  const [burst, setBurst] = useState(false)
  const wasClosed = useRef(status === 'closed')

  useEffect(() => {
    wasClosed.current = status === 'closed'
  }, [status])

  function handleClick() {
    if (status !== 'closed') return
    setBurst(true)
    onOpen()
    window.setTimeout(() => setBurst(false), 900)
  }

  function handleKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ' ') && status === 'closed') {
      e.preventDefault()
      handleClick()
    }
  }

  const isOpen = status === 'open'
  const isEmpty = status === 'empty'

  return (
    <div className={`chest-stage chest-stage--${status}`}>
      {burst && (
        <div className="sparkle-field" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className={`sparkle sparkle-${i}`} />
          ))}
        </div>
      )}

      <svg
        className={`chest ${isOpen ? 'chest--open' : ''} ${isEmpty ? 'chest--empty' : ''}`}
        viewBox="0 0 280 240"
        role={status === 'closed' ? 'button' : 'img'}
        tabIndex={status === 'closed' ? 0 : -1}
        aria-label={
          isEmpty
            ? 'No adventure planned yet'
            : isOpen
            ? "Today's chest, already opened"
            : "Tap to open today's chest"
        }
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <ellipse className="chest__shadow" cx="140" cy="214" rx="92" ry="12" />

        {/* body */}
        <rect className="chest__foot" x="40" y="188" width="200" height="18" rx="7" />
        <rect className="chest__body" x="40" y="122" width="200" height="76" rx="10" />
        <line className="chest__grain" x1="92" y1="126" x2="92" y2="194" />
        <line className="chest__grain" x1="140" y1="126" x2="140" y2="194" />
        <line className="chest__grain" x1="188" y1="126" x2="188" y2="194" />
        <rect className="chest__bracket" x="44" y="124" width="15" height="15" rx="4" />
        <rect className="chest__bracket" x="221" y="124" width="15" height="15" rx="4" />

        {/* lid, ears and whiskers all move together when it opens */}
        <g className="chest__lid">
          <path
            className="chest__lid-shape"
            d="M46,122 L46,104 Q46,76 76,76 L204,76 Q234,76 234,104 L234,122 Z"
          />
          <path className="chest__ear" d="M96,82 L84,40 L120,78 Z" />
          <path className="chest__ear-inner" d="M97,74 L91,52 L109,72 Z" />
          <path className="chest__ear" d="M184,82 L196,40 L160,78 Z" />
          <path className="chest__ear-inner" d="M183,74 L189,52 L171,72 Z" />

          <path className="chest__whisker" d="M118,108 Q96,102 78,106" />
          <path className="chest__whisker" d="M118,114 Q94,114 76,116" />
          <path className="chest__whisker" d="M162,108 Q184,102 202,106" />
          <path className="chest__whisker" d="M162,114 Q186,114 204,116" />
          <ellipse className="chest__nose" cx="140" cy="110" rx="6" ry="4.5" />
        </g>

        {/* paw-print latch sits over the seam */}
        <g className="chest__latch">
          <ellipse cx="140" cy="127" rx="11" ry="9" />
          <ellipse cx="126" cy="115" rx="4.4" ry="5.4" transform="rotate(-16 126 115)" />
          <ellipse cx="136" cy="108" rx="4.3" ry="5.6" transform="rotate(-4 136 108)" />
          <ellipse cx="146" cy="108" rx="4.3" ry="5.6" transform="rotate(6 146 108)" />
          <ellipse cx="155" cy="115" rx="4.2" ry="5.2" transform="rotate(18 155 115)" />
        </g>
      </svg>

      <p className="chest-hint">
        {isEmpty
          ? 'Nothing planned for this day yet'
          : isOpen
          ? 'Opened for today'
          : 'Tap the chest'}
      </p>
    </div>
  )
}
