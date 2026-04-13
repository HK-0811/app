import type { VercelApiHandler, VercelRequest } from '@vercel/node'
import fs from 'fs'
import path from 'path'

interface ClothingMetadataEntry {
  image_file: string
  garment_type: string
  style: string
  kurta_color: string
  bottom_color: string
  design_details: string
}

interface ClothingMetadataDocument {
  clothing_metadata: ClothingMetadataEntry[]
}

const handler: VercelApiHandler = async (req: VercelRequest, res) => {
  const { metadata, fileName } = req.body as {
    metadata?: { garment_type?: string; style?: string; color?: string; design_details?: string }
    fileName?: string
  }

  if (!metadata) {
    res.status(400).json({ error: 'Missing metadata' })
    return
  }

  try {
    const metadataPath = path.join(process.cwd(), 'public', 'wardrobe', 'clothing_metadata.json')
    let existingData: ClothingMetadataDocument = { clothing_metadata: [] }

    if (fs.existsSync(metadataPath)) {
      existingData = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    }

    const baseFileName = fileName || `user_${Date.now()}`

    const newEntry: ClothingMetadataEntry = {
      image_file: `${baseFileName}.jpg`,
      garment_type: metadata.garment_type || 'Unknown',
      style: metadata.style || 'Unknown',
      kurta_color: metadata.color || 'Unknown',
      bottom_color: 'Unknown',
      design_details: metadata.design_details || '',
    }

    existingData.clothing_metadata.push(newEntry)
    fs.writeFileSync(metadataPath, JSON.stringify(existingData, null, 2))

    console.log('[wardrobe-save] Added:', newEntry)
    res.json({ success: true, entry: newEntry })
  } catch (error) {
    console.error('[wardrobe-save] Error:', error)
    res.status(500).json({ error: 'Failed to save metadata' })
  }
}

export default handler