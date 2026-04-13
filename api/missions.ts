import type { VercelApiHandler } from '@vercel/node'
import fs from 'fs'
import path from 'path'

type MissionStage = 'idle' | 'transcribing' | 'planning' | 'selecting' | 'rendering' | 'done' | 'error'

interface MissionResult {
  id: string
  stage: MissionStage
  missionText: string
  selectedItems: string[]
  explanation: string
  finalImageUrl: string | null
  error: string | null
  stageTimings: Record<string, number>
}

const missions = new Map<string, MissionResult>()

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const handler: VercelApiHandler = async (req, res) => {
  const { method, query, body } = req

  console.log('[missions] Method:', method, 'Body:', JSON.stringify(body).substring(0, 100))

  if (method === 'POST') {
    const missionText = typeof body?.text === 'string' ? body.text.trim() : ''

    if (!missionText) {
      res.status(400).json({ error: 'Provide text to start the mission.' })
      return
    }

    const id = generateId()
    const mission: MissionResult = {
      id,
      stage: 'planning',
      missionText,
      selectedItems: [],
      explanation: '',
      finalImageUrl: null,
      error: null,
      stageTimings: {},
    }

    missions.set(id, mission)

    console.log('[missions] Created mission:', id)

    // Run mission pipeline asynchronously
    runMissionPipeline(id, missionText).catch(err => {
      console.error('[missions] Pipeline error:', err)
      const m = missions.get(id)
      if (m) {
        m.stage = 'error'
        m.error = String(err)
      }
    })

    res.json({ id, stage: 'planning' })
    return
  }

  if (method === 'GET') {
    const id = (query as any).id as string | undefined
    if (!id) {
      res.status(400).json({ error: 'Missing mission id' })
      return
    }
    const mission = missions.get(id)
    if (!mission) {
      res.status(404).json({ error: 'Mission not found' })
      return
    }
    res.json(mission)
    return
  }

  res.status(400).json({ error: 'Invalid request' })
}

async function runMissionPipeline(missionId: string, missionText: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    const m = missions.get(missionId)
    if (m) {
      m.stage = 'error'
      m.error = 'OPENROUTER_API_KEY not configured'
    }
    return
  }

  // Load wardrobe
  const wardrobe = await loadWardrobeCatalog()
  
  // Select outfit using OpenRouter
  const selection = await selectOutfitWithOpenRouter(missionText, wardrobe, apiKey)
  
  const m = missions.get(missionId)
  if (!m) return

  m.selectedItems = selection.selectedItems
  m.explanation = selection.explanation

  // Generate image
  if (selection.imageUrl) {
    m.finalImageUrl = selection.imageUrl
    m.stage = 'done'
  } else {
    m.stage = 'error'
    m.error = 'Failed to generate image'
  }
}

async function loadWardrobeCatalog() {
  const wardrobePath = path.join(process.cwd(), 'public', 'wardrobe')
  const metadataPath = path.join(wardrobePath, 'clothing_metadata.json')
  
  interface ClothingItem {
    id: string
    name: string
    colors: string[]
    sourceImageFile: string
    localImagePath?: string
  }

  try {
    const items: ClothingItem[] = []
    
    if (fs.existsSync(metadataPath)) {
      const doc = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      for (const entry of doc.clothing_metadata || []) {
        const id = entry.image_file.replace(/\.[^/.]+$/, '')
        items.push({
          id,
          name: entry.garment_type,
          colors: [entry.kurta_color, entry.bottom_color].filter(Boolean),
          sourceImageFile: entry.image_file,
        })
      }
    }
    return items
  } catch {
    return []
  }
}

interface SelectionResult {
  selectedItems: string[]
  explanation: string
  imageUrl?: string
}

async function selectOutfitWithOpenRouter(missionText: string, wardrobe: { id: string; name: string; colors: string[] }[], apiKey: string): Promise<SelectionResult> {
  const text = missionText.toLowerCase()
  
  // Simple matching - in production use OpenRouter API
  let selected = wardrobe.find(item => {
    const name = item.name.toLowerCase()
    if (text.includes('date') || text.includes('dinner') || text.includes('night')) {
      return name.includes('kurta') || name.includes('shirt')
    }
    if (text.includes('casual') || text.includes('day')) {
      return name.includes('tshirt') || name.includes(' shirt')
    }
    return false
  })

  if (!selected && wardrobe.length > 0) {
    selected = wardrobe[0]
  }

  if (!selected) {
    return { selectedItems: [], explanation: 'No items in wardrobe' }
  }

  return {
    selectedItems: [selected.id],
    explanation: `Selected ${selected.name} for "${missionText}"`,
  }
}

export default handler