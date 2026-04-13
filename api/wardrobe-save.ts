import type { VercelApiHandler, VercelRequest } from '@vercel/node'

const handler: VercelApiHandler = async (req: VercelRequest, res) => {
  res.status(501).json({
    error: 'Wardrobe saving is local-only in this deployment.',
  })
}

export default handler
