import type { MissionResult, WardrobeItem } from '../types'

interface Props {
  mission: MissionResult
  wardrobe: WardrobeItem[]
  onReplay: () => void
  onNewMission: () => void
}

function uniqueById(items: WardrobeItem[]) {
  return items.filter((item, index) => items.findIndex((entry) => entry.id === item.id) === index)
}

export function WalkoutReveal({ mission, wardrobe, onReplay, onNewMission }: Props) {
  const selectedItems = uniqueById(
    mission.selectedItems
    .map((id) => wardrobe.find((item) => item.id === id))
    .filter(Boolean) as WardrobeItem[]
  )

  return (
    <div className="step step-reveal">
      <div className="atelier-bar">
        <span className="atelier-mark">Reveal</span>
        <span className="atelier-meta">Selected from your wardrobe</span>
      </div>

      <p className="step-label">Step 04</p>
      <h2 className="reveal-title">This is the exact pull for your mission.</h2>

      <div className="reveal-intro-card">
        <span className="reveal-intro-label">Your brief</span>
        <p className="reveal-mission-text">{mission.missionText}</p>
        <p className="reveal-explanation">{mission.explanation}</p>
      </div>

      <div className="reveal-option-list">
        <article className="reveal-option-card">
          <div className="reveal-option-head">
            <span>Mission pick</span>
            <strong>Only items found in your saved locker</strong>
            <p>No fallback styling pieces, no generated extras.</p>
          </div>

          <div className="reveal-board">
            {selectedItems.map((item, index) => (
              <div
                key={item.id}
                className={`reveal-board-item reveal-board-item-${index + 1}`}
              >
                <img src={item.imagePath} alt={item.name} className="reveal-board-image" />
              </div>
            ))}
          </div>

          <div className="reveal-item-stack">
            {selectedItems.map((item) => (
              <div key={item.id} className="reveal-item-card">
                <div className="reveal-item-img">
                  <img src={item.imagePath} alt={item.name} className="reveal-item-image" />
                </div>
                <div className="reveal-item-info">
                  <strong>{item.name}</strong>
                  <span className="reveal-item-cat">{item.style ?? item.category}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="reveal-actions">
        <button className="btn-primary" onClick={onNewMission}>
          New Mission
        </button>
        <button className="btn-secondary" onClick={onReplay}>
          Back to Start
        </button>
      </div>
    </div>
  )
}
