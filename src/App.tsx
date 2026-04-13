import { useState, useEffect, useCallback, useRef } from 'react'
import { StartMission } from './components/StartMission'
import { DropMission } from './components/DropMission'
import { CookingStage } from './components/CookingStage'
import { WalkoutReveal } from './components/WalkoutReveal'
import { WardrobeDrawer } from './components/WardrobeDrawer'
import { createMission, pollMission, fetchWardrobe } from './lib/api'
import type { AppStep, MissionInput, MissionResult, WardrobeItem } from './types'

export default function App() {
  const [step, setStep] = useState<AppStep>('start')
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null)
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopPollingRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    fetchWardrobe().then(setWardrobe).catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      stopPollingRef.current?.()
    }
  }, [])

  const handleSubmitMission = useCallback(async ({ text, audio }: MissionInput) => {
    setError(null)
    try {
      const { id } = await createMission(text, audio)
      setStep('cooking')
      setMissionResult({
        id,
        stage: audio ? 'transcribing' : 'planning',
        missionText: text?.trim() ?? '',
        selectedItems: [],
        explanation: '',
        finalImageUrl: null,
        error: null,
      })

      stopPollingRef.current?.()
      stopPollingRef.current = pollMission(id, (m) => {
        setMissionResult(m)
        if (m.stage === 'done') {
          setStep('reveal')
        }
        if (m.stage === 'error') {
          setError(m.error || 'Something went wrong')
          setStep('mission')
        }
      })
    } catch {
      setError('Failed to start mission. Check the server.')
    }
  }, [])

  const handleReplay = useCallback(() => {
    setStep('start')
    setMissionResult(null)
    setError(null)
    stopPollingRef.current?.()
  }, [])

  const handleNewMission = useCallback(() => {
    setStep('mission')
    setMissionResult(null)
    setError(null)
    stopPollingRef.current?.()
  }, [])

  return (
    <div className="app-shell">
      {step === 'start' && (
        <StartMission onStart={() => setStep('mission')} />
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
