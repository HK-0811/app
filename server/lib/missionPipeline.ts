import path from 'path'
import { resolveWardrobeItems, writeImageDataUrl } from './catalog'
import { generateLookWithOpenRouter, selectOutfitWithOpenRouter } from './openRouter'
import type { MissionResult, MissionStage, WardrobeItem } from './types'
import { getBaseImagePath } from './wardrobeCatalog'

interface MissionAudioInput {
  buffer: Buffer
  mimeType: string
  fileName: string
}

interface PipelineContext {
  mission: MissionResult
  wardrobe: WardrobeItem[]
  publicRoot: string
  wardrobeRoot: string
  audio?: MissionAudioInput
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function setStage(mission: MissionResult, stage: MissionStage) {
  mission.stage = stage
  mission.stageTimings[stage] = Date.now()
}

export async function runMissionPipeline({
  mission,
  wardrobe,
  publicRoot,
  wardrobeRoot,
}: PipelineContext) {
  try {
    setStage(mission, 'planning')
    await sleep(250)

    setStage(mission, 'selecting')
    const decision = await selectOutfitWithOpenRouter(mission.missionText, wardrobe)
    mission.selectedItems = decision.selectedItems
    mission.explanation = decision.explanation
    await sleep(250)

    setStage(mission, 'rendering')
    const selectedGarments = resolveWardrobeItems(mission.selectedItems, wardrobe)
    const selectedGarment = selectedGarments[0]

    if (!selectedGarment) {
      throw new Error('No wardrobe item was selected for image generation.')
    }

    const generatedImage = await generateLookWithOpenRouter(
      mission.missionText,
      selectedGarment,
      decision.generationPrompt ??
        `Dress the character in ${selectedGarment.name}.`,
      getBaseImagePath(wardrobeRoot)
    )

    if (generatedImage) {
      const outputPath = path.join(publicRoot, 'generated', `${mission.id}.png`)
      writeImageDataUrl(outputPath, generatedImage)
      mission.finalImageUrl = `/generated/${mission.id}.png`
    } else {
      mission.finalImageUrl = '/wardrobe-assets/base_img.png'
    }

    setStage(mission, 'done')
  } catch (error) {
    console.error('[MissionPipeline] Error:', error)
    mission.stage = 'error'
    mission.error =
      error instanceof Error ? error.message : 'Mission pipeline failed.'
  }
}
