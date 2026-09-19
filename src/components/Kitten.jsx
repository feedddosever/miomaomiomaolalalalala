// The kitten's drawing, centred on the origin so it can be dropped into
// the chest's own SVG or into a standalone one as it wanders the page.
export default function Kitten() {
  return (
    <>
      <path className="kitten__ear" d="M-15,-16 L-21,-35 L-1,-23 Z" />
      <path className="kitten__ear-inner" d="M-13,-18 L-17,-29 L-6,-22 Z" />
      <path className="kitten__ear" d="M15,-16 L21,-35 L1,-23 Z" />
      <path className="kitten__ear-inner" d="M13,-18 L17,-29 L6,-22 Z" />

      <ellipse className="kitten__head" cx="0" cy="0" rx="23" ry="20" />

      <g className="kitten__eyes">
        <ellipse cx="-7" cy="-3" rx="3" ry="3.6" />
        <ellipse cx="9" cy="-3" rx="3" ry="3.6" />
      </g>

      <ellipse className="kitten__nose" cx="1" cy="5" rx="3" ry="2.2" />
      <path className="kitten__whisker" d="M6,7 Q18,5 27,8" />
      <path className="kitten__whisker" d="M6,10 Q18,12 26,15" />
      <path className="kitten__whisker" d="M-4,7 Q-14,6 -21,9" />

      <ellipse className="kitten__paw" cx="-9" cy="22" rx="8" ry="5.5" />
    </>
  )
}
