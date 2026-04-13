import type { VercelApiHandler } from '@vercel/node'
import fs from 'fs'
import path from 'path'
import { loadWardrobeManifest } from '../server/lib/catalog'

function resolveManifestPath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'wardrobe', 'manifest.json'),
    path.resolve(__dirname, '..', 'public', 'wardrobe', 'manifest.json'),
    path.resolve(__dirname, 'public', 'wardrobe', 'manifest.json'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  console.error('[wardrobe] Could not find manifest.json in any candidate path')
  return candidates[0]
}

const handler: VercelApiHandler = async (_req, res) => {
  try {
    const manifestPath = resolveManifestPath()
    const items = loadWardrobeManifest(manifestPath)
    res.json(items)
  } catch (error) {
    console.error('[wardrobe] Error:', error)
    res.status(500).json({ error: 'Failed to load wardrobe' })
  }
}

export default handler

