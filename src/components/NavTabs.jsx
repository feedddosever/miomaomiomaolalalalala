// "Plan Ahead" deliberately isn't here -- the planner is hidden behind the
// passcode (see src/lib/adminAccess.js) so visitors only ever see the two
// read-and-tick tabs.
const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'treasures', label: 'My Treasures' },
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
