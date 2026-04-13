import type { VercelApiHandler } from '@vercel/node'
import path from 'path'
import { loadWardrobeManifest } from '../server/lib/catalog'

const manifestPath = path.join(process.cwd(), 'public', 'wardrobe', 'manifest.json')

const handler: VercelApiHandler = async (_req, res) => {
  try {
    const items = loadWardrobeManifest(manifestPath)
    res.json(items)
  } catch (error) {
    console.error('[wardrobe] Error:', error)
    res.status(500).json({ error: 'Failed to load wardrobe' })
  }
}

export default handler
