import {
  loadWardrobeManifest,
  resolveAbsoluteAssetUrl,
  resolveAssetFilePath,
  resolveWardrobeItems,
} from './catalog'
import { generateLookWithOpenRouter, selectOutfitWithOpenRouter } from './openRouter'
import type { MissionResult, MissionStage } from './types'
import path from 'path'

interface CreateMissionOptions {
  missionText: string
  wardrobeRoot: string
  assetSourceMode: 'file' | 'url'
  assetBaseUrl?: string
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
  assetSourceMode,
  assetBaseUrl,
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
    const manifestPath = path.join(wardrobeRoot, 'manifest.json')
    const wardrobe = loadWardrobeManifest(manifestPath)
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
        const baseImagePath = path.join(wardrobeRoot, 'base_img.png')
        const garmentImagePath = resolveAssetFilePath(wardrobeRoot, selectedItem.imagePath)
        if (assetSourceMode === 'url' && !assetBaseUrl) {
          throw new Error('Missing asset base URL for public image generation.')
        }
        const generatedImage = await generateLookWithOpenRouter(
          missionText,
          selectedItem,
          decision.generationPrompt ?? `Style the wardrobe item ${selectedItem.name}.`,
          assetSourceMode === 'file'
            ? {
                baseImagePath,
                garmentImagePath,
              }
            : {
                baseImageUrl: resolveAbsoluteAssetUrl(
                  assetBaseUrl,
                  '/wardrobe/base_img.png'
                ),
                garmentImageUrl: resolveAbsoluteAssetUrl(
                  assetBaseUrl,
                  selectedItem.imagePath
                ),
              }
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
