import { useState, useEffect, useCallback } from 'react'
import { StartMission } from './components/StartMission'
import { DropMission } from './components/DropMission'
import { CookingStage } from './components/CookingStage'
import { WalkoutReveal } from './components/WalkoutReveal'
import { WardrobeDrawer } from './components/WardrobeDrawer'
import { createMission, fetchWardrobe } from './lib/api'
import type { AppStep, MissionInput, MissionResult, WardrobeItem } from './types'

export default function App() {
  const [step, setStep] = useState<AppStep>('start')
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null)
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWardrobe().then(setWardrobe).catch(() => {})
  }, [])

  const handleSubmitMission = useCallback(async ({ text, audio }: MissionInput) => {
    setError(null)
    setStep('cooking')
    setMissionResult({
      id: 'pending',
      stage: audio ? 'transcribing' : 'planning',
      missionText: text?.trim() ?? '',
      selectedItems: [],
      explanation: '',
      finalImageUrl: null,
      error: null,
    })

    try {
      const [mission] = await Promise.all([
        createMission(text, audio),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ])

      setMissionResult(mission)
      if (mission.stage === 'error') {
        setError(mission.error || 'Something went wrong')
        setStep('mission')
        return
      }

      setStep('reveal')
    } catch {
      setError('Failed to start mission. Check the server.')
      setStep('mission')
    }
  }, [])

  const handleReplay = useCallback(() => {
    setStep('start')
    setMissionResult(null)
    setError(null)
  }, [])

  const handleNewMission = useCallback(() => {
    setStep('mission')
    setMissionResult(null)
    setError(null)
  }, [])

  return (
    <div className="app-shell">
      {step === 'start' && (
        <StartMission
          onStart={() => setStep('mission')}
          previewItems={wardrobe.slice(0, 4)}
        />
      )}

      {step === 'mission' && (
        <DropMission
          onSubmit={handleSubmitMission}
          onOpenWardrobe={() => setDrawerOpen(true)}
          error={error}
        />
      )}

      {step === 'cooking' && (
        <CookingStage mission={missionResult} />
      )}

      {step === 'reveal' && missionResult && (
        <WalkoutReveal
          mission={missionResult}
          wardrobe={wardrobe}
          onReplay={handleReplay}
          onNewMission={handleNewMission}
        />
      )}

      <WardrobeDrawer
        open={drawerOpen}
        items={wardrobe}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
