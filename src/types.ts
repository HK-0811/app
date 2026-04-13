export interface WardrobeItem {
  id: string
  name: string
  category: 'top' | 'bottom' | 'shoes' | 'accessory' | 'eyewear'
  imagePath: string
  colors: string[]
  styleTags: string[]
  layerRole: string
}

export type MissionStage = 'idle' | 'transcribing' | 'planning' | 'selecting' | 'rendering' | 'done' | 'error'

export interface MissionInput {
  text?: string
  audio?: Blob
}

export interface MissionResult {
  id: string
  stage: MissionStage
  missionText: string
  selectedItems: string[]
  explanation: string
  finalImageUrl: string | null
  error: string | null
  stageTimings?: Record<string, number>
}

export type AppStep = 'start' | 'mission' | 'cooking' | 'reveal'
