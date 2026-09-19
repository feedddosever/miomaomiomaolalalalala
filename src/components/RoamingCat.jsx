import Kitten from './Kitten'

/**
 * The kitten once it has left the chest: a small overlay that slides in
 * from whichever edge the spot names, sits there, and slips away again.
 * Decorative only -- it never intercepts a tap.
 */
export default function RoamingCat({ spot, visible }) {
  if (!spot || !spot.top) return null

  return (
    <div
      className={`roaming-cat roaming-cat--from-${spot.from} ${
        visible ? 'roaming-cat--visible' : ''
      }`}
      style={{ top: spot.top, left: spot.left }}
      aria-hidden="true"
    >
      <svg
        className={`roaming-cat__svg ${spot.flip ? 'roaming-cat__svg--flip' : ''}`}
        viewBox="-34 -40 68 74"
      >
        <Kitten />
      </svg>
    </div>
  )
}
