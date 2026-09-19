export default function BonusCard({ type, bonus }) {
  // `bonus jsonb not null` still allows the JSON value null, so a row
  // hand-edited in the Supabase dashboard can arrive as null and used to
  // crash the whole page on bonus.title. Just show no bonus instead.
  if (!bonus || typeof bonus !== 'object') return null

  if (type === 'recipe') {
    return (
      <div className="bonus-card bonus-card--recipe">
        <span className="bonus-card__label">Bonus recipe</span>
        <h3 className="bonus-card__title">{bonus.title}</h3>
        {bonus.ingredients?.length > 0 && (
          <div className="bonus-card__section">
            <h4>Ingredients</h4>
            <ul>
              {bonus.ingredients.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {bonus.instructions?.length > 0 && (
          <div className="bonus-card__section">
            <h4>Steps</h4>
            <ol>
              {bonus.instructions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    )
  }

  if (type === 'instagram') {
    return (
      <div className="bonus-card bonus-card--instagram">
        <span className="bonus-card__label">Bonus find</span>
        <h3 className="bonus-card__title">{bonus.caption || 'A little something for you'}</h3>
        <a
          className="bonus-card__link"
          href={bonus.url}
          target="_blank"
          rel="noreferrer"
        >
          Open on Instagram
        </a>
      </div>
    )
  }

  return null
}
