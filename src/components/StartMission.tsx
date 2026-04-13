interface Props {
  onStart: () => void
}

export function StartMission({ onStart }: Props) {
  return (
    <div className="step step-start">
      <div className="start-content">
        <p className="step-label">Step 01</p>
        <h1 className="start-title">FASHION<br />SPIN</h1>
        <p className="start-sub">
          One mission. One outfit. Zero compromises.
        </p>
        <p className="start-desc">
          Tell us where you're headed and we'll pull the perfect fit
          from your locker — styled, matched, and ready to walk out.
        </p>
        <button className="btn-primary" onClick={onStart}>
          Start Mission
        </button>
      </div>
      <div className="start-decoration">
        <div className="deco-circle deco-circle-1" />
        <div className="deco-circle deco-circle-2" />
      </div>
    </div>
  )
}
