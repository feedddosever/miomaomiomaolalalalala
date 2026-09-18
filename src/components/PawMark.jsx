export default function PawMark({ filled = false, className = '' }) {
  return (
    <svg
      className={`paw-mark ${filled ? 'paw-mark--filled' : ''} ${className}`}
      viewBox="0 0 32 32"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="20" rx="9" ry="7.5" />
      <ellipse cx="6.5" cy="11.5" rx="3.4" ry="4.2" transform="rotate(-18 6.5 11.5)" />
      <ellipse cx="14" cy="6.5" rx="3.4" ry="4.4" transform="rotate(-4 14 6.5)" />
      <ellipse cx="22" cy="6.8" rx="3.4" ry="4.4" transform="rotate(8 22 6.8)" />
      <ellipse cx="27" cy="12.5" rx="3.2" ry="4" transform="rotate(22 27 12.5)" />
    </svg>
  )
}
