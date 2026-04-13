import { toDataUrlFromFile } from './catalog'
import type { OutfitDecision, WardrobeItem } from './types'

interface OpenRouterChoice {
  message?: {
    content?: string
    images?: Array<{
      image_url?: {
        url?: string
      }
    }>
  }
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[]
}

interface SelectionResult {
  selectedItemId: string
  explanation: string
  generationPrompt: string
}

function getOpenRouterHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    ...(process.env.OPENROUTER_SITE_URL
      ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL }
      : {}),
    ...(process.env.OPENROUTER_APP_NAME
      ? { 'X-Title': process.env.OPENROUTER_APP_NAME }
      : {}),
  }
}

function summarizeWardrobe(wardrobe: WardrobeItem[]) {
  return wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    garmentType: item.garmentType,
    style: item.style,
    colors: item.colors,
    designDetails: item.designDetails,
    sourceImageFile: item.sourceImageFile,
  }))
}

function fallbackSelection(missionText: string, wardrobe: WardrobeItem[]): OutfitDecision {
  const text = missionText.toLowerCase()

  const selected =
    wardrobe.find(
      (item) =>
        /date|dinner|night|evening/.test(text) &&
        item.colors.includes('maroon')
    ) ??
    wardrobe.find(
      (item) => /shaadi|wedding|festive/.test(text) && item.colors.includes('mustard')
    ) ??
    wardrobe.find(
      (item) => /college|casual|day/.test(text) && item.colors.includes('light')
    ) ??
    wardrobe[0]

  if (!selected) {
    throw new Error('Wardrobe is empty.')
  }

  return {
    selectedItems: [selected.id],
    explanation: `Picked ${selected.name} from the wardrobe for "${missionText}".`,
    generationPrompt:
      `Dress the base character in the exact garment shown in the reference image for ${selected.name}. ` +
      `Keep the face, pose, and body proportions unchanged, and make the result look like a polished fashion portrait.`,
  }
}

function parseDecision(content: string, wardrobe: WardrobeItem[]) {
  const parsed = JSON.parse(content) as SelectionResult
  if (
    typeof parsed.selectedItemId !== 'string' ||
    typeof parsed.explanation !== 'string' ||
    typeof parsed.generationPrompt !== 'string'
  ) {
    throw new Error('OpenRouter did not return the expected JSON shape.')
  }

  if (!wardrobe.some((item) => item.id === parsed.selectedItemId)) {
    throw new Error('OpenRouter selected a garment id outside the wardrobe.')
  }

  return {
    selectedItems: [parsed.selectedItemId],
    explanation: parsed.explanation,
    generationPrompt: parsed.generationPrompt,
  }
}

export async function selectOutfitWithOpenRouter(
  missionText: string,
  wardrobe: WardrobeItem[]
): Promise<OutfitDecision> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('[OpenRouter] OPENROUTER_API_KEY missing; using local fallback selection.')
    return fallbackSelection(missionText, wardrobe)
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: process.env.OPENROUTER_SELECTOR_MODEL ?? 'openai/gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a fashion stylist selecting one exact garment image from a local wardrobe. ' +
            'Return JSON only with keys selectedItemId, explanation, and generationPrompt. ' +
            'selectedItemId must match one id from the wardrobe list exactly.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            missionText,
            wardrobe: summarizeWardrobe(wardrobe),
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    return fallbackSelection(missionText, wardrobe)
  }

  const result = (await response.json()) as OpenRouterResponse
  const content = result.choices?.[0]?.message?.content
  if (!content) {
    return fallbackSelection(missionText, wardrobe)
  }

  try {
    return parseDecision(content, wardrobe)
  } catch {
    return fallbackSelection(missionText, wardrobe)
  }
}

export async function generateLookWithOpenRouter(
  missionText: string,
  selectedItem: WardrobeItem,
  generationPrompt: string,
  baseImagePath: string
) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('[OpenRouter] OPENROUTER_API_KEY missing; using base image fallback.')
    return null
  }

  if (!selectedItem.localImagePath) {
    throw new Error('Selected wardrobe item is missing a local image path.')
  }

  const model = process.env.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-3.1-flash-image-preview'

  const requestBody = {
    model,
    modalities: ['image', 'text'],
    image_config: {
      aspect_ratio: '9:16',
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `${generationPrompt} Match the mission "${missionText}". ` +
              `Preserve the model identity from the first image. Use the second image as the clothing reference only. ` +
              `Keep realistic fabric, folds, and outfit fit. Return one polished portrait image.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: toDataUrlFromFile(baseImagePath),
            },
          },
          {
            type: 'image_url',
            image_url: {
              url: toDataUrlFromFile(selectedItem.localImagePath),
            },
          },
        ],
      },
    ],
  }

  console.log(`[OpenRouter] Generating image with model: ${model}`)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: getOpenRouterHeaders(),
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenRouter] Image generation failed (${response.status}): ${errorText}`)
    return null
  }

  const result = (await response.json()) as OpenRouterResponse
  return result.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null
}
