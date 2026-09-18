const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'treasures', label: 'My Treasures' },
  { id: 'plan', label: 'Plan Ahead' },
]

export default function NavTabs({ current, onChange }) {
  return (
    <nav className="nav-tabs" aria-label="Sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`nav-tab ${current === tab.id ? 'nav-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
