import PawMark from './PawMark'

export default function QuestList({ quests, onToggle, readOnly = false }) {
  return (
    <ul className="quest-list">
      {quests.map((quest, i) => (
        <li key={i} className={`quest-item ${quest.done ? 'quest-item--done' : ''}`}>
          <button
            type="button"
            className="quest-check"
            disabled={readOnly}
            onClick={() => onToggle && onToggle(i)}
            aria-pressed={quest.done}
            aria-label={quest.done ? 'Mark as not done' : 'Mark as done'}
          >
            <PawMark filled={quest.done} />
          </button>
          <span className="quest-text">{quest.text}</span>
        </li>
      ))}
    </ul>
  )
}
