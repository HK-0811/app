import path from 'path'
import { resolveWardrobeItems, toDataUrlFromImage, writeImageDataUrl } from './catalog'
import { generateLookWithOpenRouter, selectOutfitWithOpenRouter } from './openRouter'
import type { MissionResult, MissionStage, WardrobeItem } from './types'
import { transcribeAudioBuffer } from './whisper'

interface MissionAudioInput {
  buffer: Buffer
  mimeType: string
  fileName: string
}

interface PipelineContext {
  mission: MissionResult
  wardrobe: WardrobeItem[]
  publicRoot: string
  audio?: MissionAudioInput
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function setStage(mission: MissionResult, stage: MissionStage) {
  mission.stage = stage
  mission.stageTimings[stage] = Date.now()
}

function buildImagePromptSummary(selectedItems: WardrobeItem[]) {
  return selectedItems
    .map((item) => `${item.name} (${item.category}; ${item.colors.join(', ')})`)
    .join(', ')
}

export async function runMissionPipeline({
  mission,
  wardrobe,
  publicRoot,
  audio,
}: PipelineContext) {
  try {
    if (audio) {
      setStage(mission, 'transcribing')
      mission.missionText = await transcribeAudioBuffer(
        audio.buffer,
        audio.mimeType,
        audio.fileName
      )
      await sleep(300)
    }

    setStage(mission, 'planning')
    await sleep(250)

    setStage(mission, 'selecting')
    const decision = await selectOutfitWithOpenRouter(mission.missionText, wardrobe)
    mission.selectedItems = decision.selectedItems
    mission.explanation = decision.explanation
    await sleep(250)

    setStage(mission, 'rendering')
    const selectedGarments = resolveWardrobeItems(mission.selectedItems, wardrobe)
    const promptSummary = buildImagePromptSummary(selectedGarments)
    const imageInputs = [
      toDataUrlFromImage(publicRoot, '/character/base.png'),
      ...selectedGarments.map((item) => toDataUrlFromImage(publicRoot, item.imagePath)),
    ]

    const generatedImage = await generateLookWithOpenRouter(
      mission.missionText,
      promptSummary,
      imageInputs
    )

    if (generatedImage) {
      const outputPath = path.join(publicRoot, 'generated', `${mission.id}.png`)
      writeImageDataUrl(outputPath, generatedImage)
      mission.finalImageUrl = `/generated/${mission.id}.png`
    } else {
      mission.finalImageUrl = '/character/base.png'
    }

    setStage(mission, 'done')
  } catch (error) {
    mission.stage = 'error'
    mission.error =
      error instanceof Error ? error.message : 'Mission pipeline failed.'
  }
}
