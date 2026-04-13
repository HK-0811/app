import { wardrobeItems } from '../data/wardrobe'
import type { FitResult } from '../types'

interface FitRevealProps {
  fit: FitResult | null
  loading: boolean
  onReroll: () => void
}

export function FitReveal({ fit, loading, onReroll }: FitRevealProps) {
  const top = wardrobeItems.find((item) => item.id === fit?.topId)
  const bottom = wardrobeItems.find((item) => item.id === fit?.bottomId)

  return (
    <section className="panel section-block reveal-panel">
      <div className="section-heading">
        <p className="section-kicker">03. Final call</p>
        <div>
          <h2>Let the locker room decide</h2>
          <p>
            We are not giving you infinite options. We are giving you one solid
            answer.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state" aria-live="polite">
          <span className="loading-pill">Building your fit...</span>
          <p>Checking the vibe, the colors, and whether this deserves a mirror selfie.</p>
        </div>
      ) : fit ? (
        <div className="fit-card" aria-live="polite">
          <div className="fit-card-header">
            <div>
              <p className="eyebrow">Fit verdict</p>
              <h3>Fit locked: {fit.title}</h3>
            </div>
            <div className="confidence-chip">Confidence {fit.confidence}%</div>
          </div>

          <div className="fit-lineup">
            <div>
              <span>Top</span>
              <strong>{top?.label}</strong>
            </div>
            <div>
              <span>Bottom</span>
              <strong>{bottom?.label}</strong>
            </div>
          </div>

          <div className="reasoning-list">
            {fit.reasoning.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <blockquote>{fit.oneLiner}</blockquote>
          {fit.extra ? <p className="extra-tip">{fit.extra}</p> : null}

          <button type="button" className="reroll-button" onClick={onReroll}>
            Try Another Vibe
          </button>
        </div>
      ) : (
        <div className="empty-reveal">
          <p className="loading-pill">No fit yet</p>
          <p>
            Pick the occasion and we will pull the best fit from your saved
            wardrobe.
          </p>
        </div>
      )}
    </section>
  )
}
