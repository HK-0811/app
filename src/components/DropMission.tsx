import { useState } from 'react'
import type { MissionInput } from '../types'

interface Props {
  onSubmit: (input: MissionInput) => void
  onOpenWardrobe: () => void
  error: string | null
}

export function DropMission({ onSubmit, onOpenWardrobe, error }: Props) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim()) {
      return
    }

    onSubmit({
      text: text.trim(),
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="step step-mission">
      <p className="step-label">Step 02</p>
      <h2 className="mission-title">DROP THE MISSION</h2>
      <p className="mission-sub">
        Closet loaded. Tell us where you are headed and we will cook the look.
      </p>

      <div className="mission-input-area">
        <textarea
          className="mission-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Date at 7 pm, want something sharp but easy..."
          rows={3}
        />

        <div className="mission-actions">
          {/* Voice capture is parked for the demo build. */}

          <button
            className="btn-wardrobe"
            onClick={onOpenWardrobe}
            type="button"
          >
            Wardrobe
          </button>

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            Send Mission
          </button>
        </div>

        {error && <p className="mission-error">{error}</p>}
      </div>
    </div>
  )
}
