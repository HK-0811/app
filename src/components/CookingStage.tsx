import type { MissionResult, MissionStage } from '../types'

interface Props {
  mission: MissionResult | null
}

const stageLabels: Record<MissionStage, string> = {
  idle: 'Preparing the board',
  transcribing: 'Turning voice into text',
  planning: 'Reading the occasion and mood',
  selecting: 'Matching pieces from your wardrobe',
  rendering: 'Composing the final outfit options',
  done: 'Ready to reveal',
  error: 'Something interrupted the flow',
}

const stageOrder: MissionStage[] = ['transcribing', 'planning', 'selecting', 'rendering', 'done']

export function CookingStage({ mission }: Props) {
  const current = mission?.stage || 'idle'

  return (
    <div className="step step-cooking">
      <div className="atelier-bar">
        <span className="atelier-mark">Processing</span>
        <span className="atelier-meta">Outfit Engine</span>
      </div>

      <p className="step-label">Step 03</p>
      <h2 className="cooking-title">Building your outfit boards.</h2>
      <p className="cooking-sub">
        Matching colors, garment roles, and occasion energy across your saved locker.
      </p>

      <div className="cooking-stage-list">
        {stageOrder.map((stage, index) => {
          const stageIdx = stageOrder.indexOf(stage)
          const currentIdx = stageOrder.indexOf(current as MissionStage)
          let status: 'done' | 'active' | 'pending' = 'pending'
          if (current === stage) status = 'active'
          else if (currentIdx > stageIdx) status = 'done'

          return (
            <article key={stage} className={`cooking-card cooking-card-${status}`}>
              <div className="cooking-card-top">
                <span className="cooking-index">0{index + 1}</span>
                <span className="cooking-status">{status}</span>
              </div>
              <strong>{stageLabels[stage]}</strong>
            </article>
          )
        })}
      </div>

      <div className="cooking-ribbon">
        <span className="spinner" />
        <p>{mission?.missionText || 'Styling your request now'}</p>
      </div>
    </div>
  )
}
