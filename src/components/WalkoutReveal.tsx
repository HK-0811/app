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

function firstFromCategory(items: WardrobeItem[], category: WardrobeItem['category'], exclude: string[] = []) {
  return items.find((item) => item.category === category && !exclude.includes(item.id))
}

function buildOptionCards(selectedItems: WardrobeItem[], wardrobe: WardrobeItem[]) {
  const primaryTop = selectedItems.find((item) => item.category === 'top') ?? firstFromCategory(wardrobe, 'top')
  const primaryBottom = selectedItems.find((item) => item.category === 'bottom') ?? firstFromCategory(wardrobe, 'bottom')
  const primaryShoes = selectedItems.find((item) => item.category === 'shoes') ?? firstFromCategory(wardrobe, 'shoes')

  const primaryItems = uniqueById([primaryTop, primaryBottom, primaryShoes].filter(Boolean) as WardrobeItem[])
  const usedIds = primaryItems.map((item) => item.id)

  const alternateTop = firstFromCategory(wardrobe, 'top', usedIds) ?? primaryTop
  const alternateBottom = firstFromCategory(wardrobe, 'bottom', usedIds) ?? primaryBottom
  const alternateShoes = firstFromCategory(wardrobe, 'shoes', usedIds) ?? primaryShoes

  const secondaryItems = uniqueById([alternateTop, alternateBottom, alternateShoes].filter(Boolean) as WardrobeItem[])

  return [
    {
      badge: 'Option 01',
      title: 'Closest match',
      note: 'The main recommendation pulled from your saved wardrobe.',
      items: primaryItems,
    },
    {
      badge: 'Option 02',
      title: 'Alternate mood',
      note: 'A nearby direction if you want a slightly different energy.',
      items: secondaryItems,
    },
  ]
}

export function WalkoutReveal({ mission, wardrobe, onReplay, onNewMission }: Props) {
  const selectedItems = mission.selectedItems
    .map((id) => wardrobe.find((item) => item.id === id))
    .filter(Boolean) as WardrobeItem[]

  const options = buildOptionCards(selectedItems, wardrobe)

  return (
    <div className="step step-reveal">
      <div className="atelier-bar">
        <span className="atelier-mark">Reveal</span>
        <span className="atelier-meta">Two styled outputs</span>
      </div>

      <p className="step-label">Step 04</p>
      <h2 className="reveal-title">Two ways to wear the mission.</h2>

      <div className="reveal-intro-card">
        <span className="reveal-intro-label">Your brief</span>
        <p className="reveal-mission-text">{mission.missionText}</p>
        <p className="reveal-explanation">{mission.explanation}</p>
      </div>

      <div className="reveal-option-list">
        {options.map((option) => (
          <article key={option.badge} className="reveal-option-card">
            <div className="reveal-option-head">
              <span>{option.badge}</span>
              <strong>{option.title}</strong>
              <p>{option.note}</p>
            </div>

            <div className="reveal-board">
              {option.items.map((item, index) => (
                <div
                  key={item.id}
                  className={`reveal-board-item reveal-board-item-${index + 1}`}
                >
                  <img src={item.imagePath} alt={item.name} className="reveal-board-image" />
                </div>
              ))}
            </div>

            <div className="reveal-item-stack">
              {option.items.map((item) => (
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
        ))}
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
