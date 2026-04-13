import { occasions } from '../data/occasions'
import type { Occasion } from '../types'

interface OccasionPickerProps {
  occasion: Occasion | null
  onSelect: (occasion: Occasion) => void
}

export function OccasionPicker({ occasion, onSelect }: OccasionPickerProps) {
  return (
    <section className="panel section-block">
      <div className="section-heading">
        <p className="section-kicker">02. Where are you off to?</p>
        <div>
          <h2>Choose the scene</h2>
          <p>
            Keep it simple. One destination, one vibe, one less bad outfit.
          </p>
        </div>
      </div>

      <div className="occasion-grid">
        {occasions.map((entry) => {
          const isActive = entry.id === occasion

          return (
            <button
              key={entry.id}
              type="button"
              className={`occasion-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(entry.id)}
              aria-pressed={isActive}
            >
              <span className="occasion-vibe">{entry.vibe}</span>
              <strong>{entry.label}</strong>
              <span>{entry.prompt}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
