import { resolveWardrobeItems } from './catalog'
import { generateLookWithOpenRouter, selectOutfitWithOpenRouter } from './openRouter'
import type { MissionResult, MissionStage } from './types'
import { getBaseImagePath, loadWardrobeCatalog } from './wardrobeCatalog'

interface CreateMissionOptions {
  missionText: string
  wardrobeRoot: string
}

function createMissionId() {
  return Math.random().toString(36).slice(2, 10)
}

function setStage(mission: MissionResult, stage: MissionStage) {
  mission.stage = stage
  mission.stageTimings[stage] = Date.now()
}

export async function createMissionResult({
  missionText,
  wardrobeRoot,
}: CreateMissionOptions): Promise<MissionResult> {
  const mission: MissionResult = {
    id: createMissionId(),
    stage: 'idle',
    missionText,
    selectedItems: [],
    explanation: '',
    finalImageUrl: null,
    error: null,
    stageTimings: {},
  }

  try {
    const wardrobe = loadWardrobeCatalog(wardrobeRoot)
    if (!wardrobe.length) {
      throw new Error('Wardrobe is empty.')
    }

    setStage(mission, 'planning')
    const decision = await selectOutfitWithOpenRouter(missionText, wardrobe)

    setStage(mission, 'selecting')
    mission.selectedItems = decision.selectedItems
    mission.explanation = decision.explanation

    setStage(mission, 'rendering')
    const selectedItem = resolveWardrobeItems(decision.selectedItems, wardrobe)[0]
    if (selectedItem) {
      try {
        const generatedImage = await generateLookWithOpenRouter(
          missionText,
          selectedItem,
          decision.generationPrompt ?? `Style the wardrobe item ${selectedItem.name}.`,
          getBaseImagePath(wardrobeRoot)
        )

        mission.finalImageUrl = generatedImage ?? selectedItem.imagePath
      } catch (imageError) {
        console.error('[MissionService] Image generation fallback:', imageError)
        mission.finalImageUrl = selectedItem.imagePath
      }
    }

    setStage(mission, 'done')
  } catch (error) {
    mission.stage = 'error'
    mission.error =
      error instanceof Error ? error.message : 'Mission generation failed.'
  }

  return mission
}
