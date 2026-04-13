import type { VercelApiHandler } from '@vercel/node'
import fs from 'fs'
import path from 'path'
import { createMissionResult } from '../server/lib/missionService'

/**
 * Resolve the wardrobe root directory.
 * On Vercel, includeFiles puts them relative to the project root at process.cwd().
 * We try multiple possible locations to be robust.
 */
function resolveWardrobeRoot() {
  const candidates = [
    path.join(process.cwd(), 'public', 'wardrobe'),
    path.resolve(__dirname, '..', 'public', 'wardrobe'),
    path.resolve(__dirname, 'public', 'wardrobe'),
  ]

  for (const candidate of candidates) {
    const manifestCheck = path.join(candidate, 'manifest.json')
    if (fs.existsSync(manifestCheck)) {
      console.log('[missions] Wardrobe root resolved to:', candidate)
      return candidate
    }
  }

  // Log all candidates for debugging
  console.error('[missions] Could not find manifest.json in any candidate path:')
  for (const candidate of candidates) {
    console.error(`  - ${candidate} (exists: ${fs.existsSync(candidate)})`)
  }

  // Fall back to the first (default) candidate
  return candidates[0]
}

function getRequestBaseUrl(req: Parameters<VercelApiHandler>[0]) {
  const protoHeader = req.headers['x-forwarded-proto']
  const protocol = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader ?? 'https'
  const host = req.headers.host

  if (!host) {
    return process.env.OPENROUTER_SITE_URL ?? ''
  }

  return `${protocol}://${host}`
}

const handler: VercelApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const missionText = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

  if (!missionText) {
    res.status(400).json({ error: 'Provide text to start the mission.' })
    return
  }

  try {
    const wardrobeRoot = resolveWardrobeRoot()
    const baseUrl = process.env.OPENROUTER_SITE_URL ?? getRequestBaseUrl(req)

    console.log('[missions] Starting mission:', {
      missionText: missionText.slice(0, 50),
      wardrobeRoot,
      baseUrl,
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
    })

    const mission = await createMissionResult({
      missionText,
      wardrobeRoot,
      assetSourceMode: 'url',
      assetBaseUrl: baseUrl,
    })

    res.json(mission)
  } catch (error) {
    console.error('[missions] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create mission'
    res.status(500).json({ error: message })
  }
}

export default handler
