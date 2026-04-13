import type { MissionResult, WardrobeItem } from '../types'

interface Props {
  mission: MissionResult
  wardrobe: WardrobeItem[]
  onReplay: () => void
  onNewMission: () => void
}

export function WalkoutReveal({ mission, wardrobe, onReplay, onNewMission }: Props) {
  const selectedItems = mission.selectedItems
    .map(id => wardrobe.find(w => w.id === id))
    .filter(Boolean) as WardrobeItem[]

  return (
    <div className="step step-reveal">
      <p className="step-label">Step 04</p>
      <h2 className="reveal-title">WALKOUT<br />REVEAL</h2>

      <div className="reveal-layout">
        <div className="reveal-hero">
          {mission.finalImageUrl ? (
            <div className="reveal-image-wrap">
              <img
                src={mission.finalImageUrl}
                alt="Your styled look"
                className="reveal-image"
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = '/look-placeholder.svg'
                }}
              />
              <div className="reveal-image-badge">YOUR LOOK</div>
            </div>
          ) : (
            <div className="reveal-image-placeholder">
              <span>LOOK READY</span>
            </div>
          )}
        </div>

        <div className="reveal-details">
          <div className="reveal-mission-text">
            "{mission.missionText}"
          </div>

          <p className="reveal-explanation">{mission.explanation}</p>

          <div className="reveal-items">
            <h3 className="reveal-items-title">Selected from your locker</h3>
            <div className="reveal-item-grid">
              {selectedItems.map(item => (
                <div key={item.id} className="reveal-item-card">
                  <div className="reveal-item-img">
                    <span className="item-initial item-fallback visible">{item.name[0]}</span>
                  </div>
                  <div className="reveal-item-info">
                    <strong>{item.name}</strong>
                    <span className="reveal-item-cat">{item.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal-actions">
            <button className="btn-primary" onClick={onNewMission}>
              New Mission
            </button>
            <button className="btn-secondary" onClick={onReplay}>
              Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
