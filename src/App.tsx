import { useState, useEffect, useCallback, useRef } from 'react'
import { StartMission } from './components/StartMission'
import { DropMission } from './components/DropMission'
import { CookingStage } from './components/CookingStage'
import { WalkoutReveal } from './components/WalkoutReveal'
import { WardrobeDrawer } from './components/WardrobeDrawer'
import { AddClothing } from './components/AddClothing'
import { createMission, pollMission, fetchWardrobe, saveWardrobeMetadata } from './lib/api'
import type { AppStep, MissionInput, MissionResult, WardrobeItem } from './types'

const LOCAL_STORAGE_KEY = 'fashion_spin_wardrobe'

function loadLocalWardrobe(): WardrobeItem[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as WardrobeItem[]
  } catch {
    return []
  }
}

function saveLocalWardrobe(items: WardrobeItem[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
}

function generateId(): string {
  return 'local_' + Math.random().toString(36).slice(2, 12)
}

function detectCategory(garmentType: string): WardrobeItem['category'] {
  const type = (garmentType || '').toLowerCase()
  if (type.includes('kurta') || type.includes('shirt') || type.includes('tshirt') || 
      type.includes('t-shirt') || type.includes('sherwani') || type.includes('jacket')) {
    return 'top'
  }
  if (type.includes('jeans') || type.includes('pant') || type.includes('trouser') || 
      type.includes('churidar') || type.includes('pyjama')) {
    return 'bottom'
  }
  if (type.includes('shoe') || type.includes('sandel') || type.includes('mojaris')) {
    return 'shoes'
  }
  return 'top'
}

export default function App() {
  const [step, setStep] = useState<AppStep>('start')
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null)
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([])
  const [localWardrobe, setLocalWardrobe] = useState<WardrobeItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopPollingRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    fetchWardrobe().then(setWardrobe).catch(() => {})
  }, [])

  useEffect(() => {
    setLocalWardrobe(loadLocalWardrobe())
  }, [])

  useEffect(() => {
    return () => {
      stopPollingRef.current?.()
    }
  }, [])

  const handleAddLocalItem = useCallback(async (item: { image: string; metadata: { garment_type: string; style: string; color: string; design_details: string } }) => {
    const newItem: WardrobeItem = {
      id: generateId(),
      name: `${item.metadata.color} ${item.metadata.garment_type}`.trim() || 'New Item',
      category: detectCategory(item.metadata.garment_type),
      imagePath: item.image,
      colors: item.metadata.color ? [item.metadata.color.toLowerCase()] : [],
      styleTags: [item.metadata.style?.toLowerCase() || '', item.metadata.garment_type?.toLowerCase() || ''].filter(Boolean),
      layerRole: 'base',
      garmentType: item.metadata.garment_type,
      style: item.metadata.style,
      designDetails: item.metadata.design_details,
      source: 'local',
    }

    const updated = [...localWardrobe, newItem]
    setLocalWardrobe(updated)
    saveLocalWardrobe(updated)

    try {
      await saveWardrobeMetadata(item.metadata, newItem.id)
      console.log('[App] Metadata saved to file')
    } catch (err) {
      console.error('[App] Failed to save metadata to file:', err)
    }
  }, [localWardrobe])

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

  const allWardrobe = [...localWardrobe, ...wardrobe]

  return (
    <div className="app-shell">
      {step === 'start' && (
        <StartMission
          onStart={() => setStep('mission')}
          previewItems={allWardrobe.slice(0, 4)}
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
          wardrobe={allWardrobe}
          onReplay={handleReplay}
          onNewMission={handleNewMission}
        />
      )}

      <WardrobeDrawer
        open={drawerOpen}
        items={allWardrobe}
        onClose={() => setDrawerOpen(false)}
      />

      <AddClothing
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddLocalItem}
      />

      <button className="fab" onClick={() => setAddOpen(true)}>
        +
      </button>
    </div>
  )
}
