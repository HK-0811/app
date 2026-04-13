import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadWardrobeManifest } from './lib/catalog'
import { runMissionPipeline } from './lib/missionPipeline'
import type { MissionResult } from './lib/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const upload = multer({ storage: multer.memoryStorage() })
app.use(cors())
app.use(express.json())

// --- Load wardrobe ---

const publicRoot = path.join(__dirname, '..', 'public')
const manifestPath = path.join(publicRoot, 'wardrobe', 'manifest.json')
const wardrobe = loadWardrobeManifest(manifestPath)

// --- In-memory mission store ---

const missions = new Map<string, MissionResult>()

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// --- Wardrobe endpoint ---

app.get('/api/wardrobe', (_req, res) => {
  res.json(wardrobe)
})

// --- Mission endpoints ---

app.post('/api/missions', upload.single('audio'), (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : ''
  const audioFile = req.file
  const missionText = text

  if (!missionText && !audioFile) {
    res.status(400).json({ error: 'Provide text or audio' })
    return
  }

  const id = generateId()
  const mission: MissionResult = {
    id,
    stage: 'idle',
    missionText,
    selectedItems: [],
    explanation: '',
    finalImageUrl: null,
    error: null,
    stageTimings: {},
  }

  missions.set(id, mission)

  void runMissionPipeline({
    mission,
    wardrobe,
    publicRoot,
    audio: audioFile
      ? {
          buffer: audioFile.buffer,
          mimeType: audioFile.mimetype,
          fileName: audioFile.originalname || 'mission.webm',
        }
      : undefined,
  })

  res.json({ id, stage: mission.stage })
})

app.get('/api/missions/:id', (req, res) => {
  const mission = missions.get(req.params.id)
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' })
    return
  }
  res.json(mission)
})

// --- Mission Pipeline ---

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function setStage(mission: MissionResult, stage: MissionStage) {
  mission.stage = stage
  mission.stageTimings[stage] = Date.now()
  console.log(`[mission:${mission.id}] → ${stage}`)
}

function selectGarments(missionText: string): { items: string[], explanation: string } {
  const text = missionText.toLowerCase()

  // Simple keyword-based selection that maps mission text to wardrobe items
  const selected: string[] = []
  let vibe = ''

  // Detect occasion/vibe from text
  const isDate = /date|dinner|romantic|evening|restaurant|bar|club|night out/i.test(text)
  const isShaadi = /shaadi|wedding|festive|ceremony|function|reception|sangeet|mehendi/i.test(text)
  const isGym = /gym|workout|training|run|jog|sport|exercise|lift/i.test(text)
  const isCollege = /college|campus|class|lecture|casual|chill|hangout|friend/i.test(text)
  const isFormal = /formal|office|meeting|interview|professional/i.test(text)

  if (isShaadi) {
    selected.push('cream-kurta', 'charcoal-trousers', 'brown-loafers', 'silver-watch')
    vibe = 'festive and elevated'
  } else if (isDate) {
    selected.push('midnight-polo', 'stone-chinos', 'brown-loafers', 'aviator-shades', 'silver-watch')
    vibe = 'smooth and confident'
  } else if (isGym) {
    selected.push('training-tank', 'black-joggers', 'training-shoes', 'black-cap')
    vibe = 'athletic and sharp'
  } else if (isFormal) {
    selected.push('white-shirt', 'charcoal-trousers', 'brown-loafers', 'silver-watch')
    vibe = 'professional and polished'
  } else if (isCollege) {
    selected.push('mint-tee', 'dark-jeans', 'white-sneakers', 'black-cap')
    vibe = 'easy and fresh'
  } else {
    // Default casual
    selected.push('black-tee', 'dark-jeans', 'white-sneakers')
    vibe = 'minimal and versatile'
  }

  // Verify all selected items exist in manifest
  const validItems = selected.filter(id => wardrobe.some(w => w.id === id))

  const itemNames = validItems.map(id => wardrobe.find(w => w.id === id)!.name)
  const explanation = `For this mission, I went with a ${vibe} direction. ` +
    `The ${itemNames.slice(0, -1).join(', ')} ${itemNames.length > 1 ? 'and ' + itemNames[itemNames.length - 1] : ''} ` +
    `work together to create a look that matches the energy of "${missionText}". ` +
    `Every piece was chosen from your locker to make sure the fit feels intentional, not accidental.`

  return { items: validItems, explanation }
}

async function runMissionPipeline(mission: MissionResult, hasAudio: boolean) {
  try {
    // Stage 1: Transcribe (if audio)
    if (hasAudio) {
      setStage(mission, 'transcribing')
      await sleep(1200)
      // In production: call Whisper API here
      // For demo, text is already provided as fallback
    }

    // Stage 2: Planning - understand the mission
    setStage(mission, 'planning')
    await sleep(1000)

    // Stage 3: Selecting garments
    setStage(mission, 'selecting')
    await sleep(1500)

    const { items, explanation } = selectGarments(mission.missionText)
    mission.selectedItems = items
    mission.explanation = explanation

    // Stage 4: Rendering try-on image
    setStage(mission, 'rendering')
    await sleep(2000)
    // In production: call Nano Banana API here
    mission.finalImageUrl = '/character/base.png'

    // Done
    setStage(mission, 'done')

  } catch (err: any) {
    mission.stage = 'error'
    mission.error = err.message || 'Pipeline failed'
    console.error(`[mission:${mission.id}] ERROR:`, err)
  }
}

// --- Start ---

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Fashion Spin API running on http://localhost:${PORT}`)
})
