import type { VercelApiHandler } from '@vercel/node'
import path from 'path'
import { loadWardrobeCatalog } from '../server/lib/wardrobeCatalog'

const wardrobeRoot = path.join(process.cwd(), 'public', 'wardrobe')

const handler: VercelApiHandler = async (_req, res) => {
  try {
    const items = loadWardrobeCatalog(wardrobeRoot)
    res.json(items)
  } catch (error) {
    console.error('[wardrobe] Error:', error)
    res.status(500).json({ error: 'Failed to load wardrobe' })
  }
}

export default handler
