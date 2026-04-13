import { wardrobeItems } from '../data/wardrobe'

export function WardrobePicker() {
  const tops = wardrobeItems.filter((item) => item.type === 'top')
  const bottoms = wardrobeItems.filter((item) => item.type === 'bottom')

  return (
    <section className="panel section-block">
      <div className="section-heading">
        <p className="section-kicker">01. Closet loaded</p>
        <div>
          <h2>Your wardrobe is already in</h2>
          <p>
            Think of this as the saved closet. The only thing you need to tell
            us now is where you are headed.
          </p>
        </div>
      </div>

      <div className="closet-summary">
        <div className="closet-count">
          <span className="item-type">Saved tops</span>
          <strong>{tops.length}</strong>
        </div>
        <div className="closet-count">
          <span className="item-type">Saved bottoms</span>
          <strong>{bottoms.length}</strong>
        </div>
      </div>

      <div className="wardrobe-grid static">
        {wardrobeItems.map((item) => (
          <div key={item.id} className="wardrobe-card static-card">
            <span className="item-type">{item.type}</span>
            <strong>{item.label}</strong>
            <span>{item.color}</span>
            <small>{item.styleTags.join(' / ')}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
