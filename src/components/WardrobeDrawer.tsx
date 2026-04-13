import type { WardrobeItem } from '../types'

interface Props {
  open: boolean
  items: WardrobeItem[]
  onClose: () => void
}

const categoryOrder = ['top', 'bottom', 'shoes', 'eyewear', 'accessory'] as const

export function WardrobeDrawer({ open, items, onClose }: Props) {
  if (!open) return null

  const grouped = categoryOrder
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="drawer-kicker">Saved wardrobe</span>
            <h3>Your Locker</h3>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="drawer-body">
          {grouped.map(({ category, items: categoryItems }) => (
            <section key={category} className="drawer-section">
              <div className="drawer-section-head">
                <p className="drawer-cat-label">{category}</p>
                <span>{categoryItems.length} saved</span>
              </div>

              <div className="drawer-grid">
                {categoryItems.map((item) => (
                  <article key={item.id} className="drawer-product-card">
                    <div className="drawer-item-thumb">
                      <img src={item.imagePath} alt={item.name} className="drawer-item-image" />
                    </div>
                    <div className="drawer-item-info">
                      <strong>{item.name}</strong>
                      <span className="drawer-item-tags">{item.style ?? item.colors.join(', ')}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
