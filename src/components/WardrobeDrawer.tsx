import type { WardrobeItem } from '../types'

interface Props {
  open: boolean
  items: WardrobeItem[]
  onClose: () => void
}

const categoryOrder = ['top', 'bottom', 'shoes', 'eyewear', 'accessory'] as const

export function WardrobeDrawer({ open, items, onClose }: Props) {
  if (!open) return null

  const grouped = categoryOrder.map(cat => ({
    category: cat,
    items: items.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>YOUR LOCKER</h3>
          <button className="drawer-close" onClick={onClose}>&times;</button>
        </div>
        <div className="drawer-body">
          {grouped.map(({ category, items: catItems }) => (
            <div key={category} className="drawer-section">
              <p className="drawer-cat-label">{category}</p>
              <div className="drawer-items">
                {catItems.map(item => (
                  <div key={item.id} className="drawer-item">
                    <div className="drawer-item-thumb">
                      <span className="item-initial item-fallback visible">{item.name[0]}</span>
                    </div>
                    <div className="drawer-item-info">
                      <strong>{item.name}</strong>
                      <span className="drawer-item-tags">{item.colors.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
