import type { VercelApiHandler } from '@vercel/node'
import path from 'path'
import { createMissionResult } from '../server/lib/missionService'

const wardrobeRoot = path.join(process.cwd(), 'public', 'wardrobe')

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
    const mission = await createMissionResult({
      missionText,
      wardrobeRoot,
      assetSourceMode: 'url',
      assetBaseUrl: process.env.OPENROUTER_SITE_URL ?? getRequestBaseUrl(req),
    })

    res.json(mission)
  } catch (error) {
    console.error('[missions] Error:', error)
    res.status(500).json({ error: 'Failed to create mission' })
  }
}

export default handler
