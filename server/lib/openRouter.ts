import { pickFallbackOutfit } from './fallbackStylist'
import { summarizeWardrobe } from './catalog'
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

function parseDecision(content: string, wardrobe: WardrobeItem[]) {
  const parsed = JSON.parse(content) as OutfitDecision
  if (!Array.isArray(parsed.selectedItems) || typeof parsed.explanation !== 'string') {
    throw new Error('OpenRouter did not return the expected JSON shape.')
  }

  const allIdsValid = parsed.selectedItems.every((id) =>
    wardrobe.some((item) => item.id === id)
  )

  if (!allIdsValid) {
    throw new Error('OpenRouter selected garment ids outside the manifest.')
  }

  return parsed
}

export async function selectOutfitWithOpenRouter(
  missionText: string,
  wardrobe: WardrobeItem[]
): Promise<OutfitDecision> {
  if (!process.env.OPENROUTER_API_KEY) {
    return pickFallbackOutfit(missionText, wardrobe)
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: process.env.OPENROUTER_TEXT_MODEL ?? 'openai/gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a fashion game stylist. Pick exact garment ids from the wardrobe summary. ' +
            'Return JSON only with keys selectedItems and explanation. ' +
            'selectedItems should contain exact ids from the provided wardrobe.',
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
    return pickFallbackOutfit(missionText, wardrobe)
  }

  const result = (await response.json()) as OpenRouterResponse
  const content = result.choices?.[0]?.message?.content
  if (!content) {
    return pickFallbackOutfit(missionText, wardrobe)
  }

  try {
    return parseDecision(content, wardrobe)
  } catch {
    return pickFallbackOutfit(missionText, wardrobe)
  }
}

export async function generateLookWithOpenRouter(
  missionText: string,
  promptSummary: string,
  inputImages: string[]
) {
  if (!process.env.OPENROUTER_API_KEY) {
    return null
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model:
        process.env.OPENROUTER_IMAGE_MODEL ??
        'google/gemini-3.1-flash-image-preview',
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: '3:4',
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Style the character in the first image using the exact garments from the following references. ` +
                `Keep the character identity intact. Match the mission "${missionText}". ${promptSummary}. ` +
                `Return one polished portrait image only.`,
            },
            ...inputImages.map((url) => ({
              type: 'image_url',
              image_url: {
                url,
              },
            })),
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    return null
  }

  const result = (await response.json()) as OpenRouterResponse
  return result.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null
}
