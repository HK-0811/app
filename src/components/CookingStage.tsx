import type { MissionResult, MissionStage } from '../types'

interface Props {
  mission: MissionResult | null
}

const stageLabels: Record<MissionStage, string> = {
  idle: 'Warming up...',
  transcribing: 'Transcribing your mission...',
  planning: 'Understanding the occasion & vibe...',
  selecting: 'Selecting exact garments from your locker...',
  rendering: 'Generating your walkout look...',
  done: 'Ready.',
  error: 'Something broke.',
}

const stageOrder: MissionStage[] = ['transcribing', 'planning', 'selecting', 'rendering', 'done']

export function CookingStage({ mission }: Props) {
  const current = mission?.stage || 'idle'

  return (
    <div className="step step-cooking">
      <p className="step-label">Step 03</p>
      <h2 className="cooking-title">LOCKER ROOM<br />COOKING</h2>

      <div className="cooking-stages">
        {stageOrder.map((stage) => {
          const stageIdx = stageOrder.indexOf(stage)
          const currentIdx = stageOrder.indexOf(current as any)
          let status: 'done' | 'active' | 'pending' = 'pending'
          if (current === stage) status = 'active'
          else if (currentIdx > stageIdx) status = 'done'

          return (
            <div key={stage} className={`cooking-step cooking-step-${status}`}>
              <span className="cooking-dot" />
              <span className="cooking-label">{stageLabels[stage]}</span>
            </div>
          )
        })}
      </div>

      <div className="cooking-spinner">
        <div className="spinner" />
      </div>
    </div>
  )
}
