import type { MissionResult, WardrobeItem } from '../types'

const wardrobeUrl = '/wardrobe/manifest.json'
const demoImageUrl = '/img1.png'
const heroLookIds = ['brown-kurta', 'cream-pajama']
const stageSchedule = [
  { stage: 'planning', delay: 450 },
  { stage: 'selecting', delay: 1000 },
  { stage: 'rendering', delay: 1650 },
  { stage: 'done', delay: 2400 },
] as const

const missionStore = new Map<string, { text: string }>()
let wardrobeCache: WardrobeItem[] = []

function generateId() {
  return `mission-${Math.random().toString(36).slice(2, 9)}`
}

function keepExisting(ids: string[], wardrobe: WardrobeItem[]) {
  return ids.filter((id) => wardrobe.some((item) => item.id === id))
}

export function selectLockerItems(_text: string, wardrobe: WardrobeItem[]) {
  return keepExisting(heroLookIds, wardrobe)
}

function buildExplanation(text: string, ids: string[]) {
  const selectedNames = ids
    .map((id) => wardrobeCache.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join(', ')

  return `Mission decoded for "${text}". We pulled ${selectedNames} from the locker so the reveal feels sharp, intentional, and demo-ready.`
}

function buildMissionResult(id: string, stage: MissionResult['stage']): MissionResult {
  const stored = missionStore.get(id)
  const missionText = stored?.text ?? 'Mission incoming'
  const selectedItems = selectLockerItems(missionText, wardrobeCache)

  return {
    id,
    stage,
    missionText,
    selectedItems: stage === 'done' ? selectedItems : [],
    explanation:
      stage === 'done'
        ? buildExplanation(missionText, selectedItems)
        : '',
    finalImageUrl: stage === 'done' ? demoImageUrl : null,
    error: null,
    stageTimings: {
      [stage]: Date.now(),
    },
  }
}

export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  if (wardrobeCache.length > 0) {
    return wardrobeCache
  }

  const res = await fetch(wardrobeUrl)
  if (!res.ok) {
    throw new Error('Failed to load wardrobe')
  }

  wardrobeCache = (await res.json()) as WardrobeItem[]
  return wardrobeCache
}

export async function createMission(
  text?: string,
  _audio?: Blob
): Promise<{ id: string }> {
  const missionText = text?.trim()
  if (!missionText) {
    throw new Error('Mission text is required')
  }

  const id = generateId()
  missionStore.set(id, { text: missionText })
  return { id }
}

export async function getMission(id: string): Promise<MissionResult> {
  return buildMissionResult(id, 'done')
}

export function pollMission(id: string, onUpdate: (m: MissionResult) => void): () => void {
  const timers = stageSchedule.map(({ stage, delay }) =>
    window.setTimeout(() => {
      onUpdate(buildMissionResult(id, stage))
    }, delay)
  )

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer))
  }
}
