import type { WardrobeItem } from '../types'

interface Props {
  onStart: () => void
  previewItems: WardrobeItem[]
}

export function StartMission({ onStart, previewItems }: Props) {
  return (
    <div className="step step-start">
      <div className="atelier-bar">
        <span className="atelier-mark">Atelier</span>
        <span className="atelier-meta">Wardrobe AI</span>
      </div>

      <div className="start-grid">
        <div className="start-copy">
          <p className="step-label">Step 01</p>
          <h1 className="start-title">Kal Kya Pehnun?</h1>
          <p className="start-sub">
            Tell the app where you are going. We turn your saved wardrobe into two clean outfit directions.
          </p>
          <p className="start-desc">
            Inspired by editorial shopping flows, built for quick decisions, and focused only on the clothes.
          </p>

          <div className="start-tags">
            <span>Flat garment visuals</span>
            <span>Two outfit options</span>
            <span>No human imagery</span>
          </div>

          <button className="btn-primary" onClick={onStart}>
            Start Mission
          </button>
        </div>

        <div className="start-board">
          <div className="start-board-label">Preview from your locker</div>
          <div className="start-board-grid">
            {previewItems.map((item, index) => (
              <article
                key={item.id}
                className={`start-garment-card start-garment-card-${index + 1}`}
              >
                <div className="start-garment-thumb">
                  <img src={item.imagePath} alt={item.name} />
                </div>
                <div className="start-garment-copy">
                  <span>{item.category}</span>
                  <strong>{item.name}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
