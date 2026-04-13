export interface WardrobeItem {
  id: string
  name: string
  category: 'top' | 'bottom' | 'shoes' | 'accessory' | 'eyewear'
  imagePath: string
  localImagePath?: string
  sourceImageFile?: string
  colors: string[]
  styleTags: string[]
  layerRole: string
  garmentType?: string
  style?: string
  bottomColor?: string
  designDetails?: string
}

export type MissionStage =
  | 'idle'
  | 'transcribing'
  | 'planning'
  | 'selecting'
  | 'rendering'
  | 'done'
  | 'error'

export interface MissionResult {
  id: string
  stage: MissionStage
  missionText: string
  selectedItems: string[]
  explanation: string
  finalImageUrl: string | null
  error: string | null
  stageTimings: Record<string, number>
}

export interface OutfitDecision {
  selectedItems: string[]
  explanation: string
  generationPrompt?: string
}
