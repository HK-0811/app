import type { VercelApiHandler } from '@vercel/node'
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

interface WardrobeItem {
  id: string
  name: string
  category: 'top' | 'bottom' | 'shoes' | 'accessory' | 'eyewear'
  imagePath: string
  colors: string[]
  styleTags: string[]
  layerRole: string
  garmentType?: string
  style?: string
  bottomColor?: string
  designDetails?: string
}

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const folderCategoryMap: Record<string, WardrobeItem['category']> = {
  kurtas: 'top',
  tshirts: 'top',
  bottoms: 'bottom',
  shoes: 'shoes',
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '')
}

function readMetadata(): Map<string, ClothingMetadataEntry> {
  const metadataPath = path.join(process.cwd(), 'public', 'wardrobe', 'clothing_metadata.json')
  try {
    if (!fs.existsSync(metadataPath)) {
      return new Map()
    }
    const document = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as ClothingMetadataDocument
    return new Map(
      document.clothing_metadata.map((entry) => [
        stripExtension(entry.image_file),
        entry,
      ])
    )
  } catch {
    return new Map()
  }
}

function collectWardrobeImages(): string[] {
  const root = path.join(process.cwd(), 'public', 'wardrobe')
  const images: string[] = []

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!imageExtensions.has(ext)) {
        continue
      }
      if (stripExtension(entry.name) === 'base_img') {
        continue
      }
      const relativePath = fullPath.replace(path.join(process.cwd(), 'public') + path.sep, '')
      images.push(relativePath.replace(/\\/g, '/'))
    }
  }

  walk(root)
  return images
}

function parseColorTokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[()]/g, '')
        .split(/[^a-z]+/)
        .filter(Boolean)
    )
  )
}

function inferDisplayName(metadata: ClothingMetadataEntry | undefined, fileStem: string): string {
  if (!metadata) {
    return fileStem.replace(/[-_]+/g, ' ')
  }
  if (metadata.garment_type.toLowerCase() === 'kurta set') {
    const parts = metadata.kurta_color.split(/[\s,(]/)
    const primaryColor = parts[0] || 'Unknown'
    return `${primaryColor} ${metadata.garment_type}`
  }
  return metadata.garment_type
}

function buildStyleTags(metadata: ClothingMetadataEntry | undefined, folderName: string): string[] {
  const tags = [folderName]
  if (!metadata) return tags
  tags.push(metadata.garment_type.toLowerCase().replace(/\s+/g, '-'))
  tags.push(metadata.style.toLowerCase().replace(/\s+/g, '-'))
  parseColorTokens(metadata.kurta_color).forEach(t => tags.push(t))
  return Array.from(new Set(tags.filter(Boolean)))
}

function loadWardrobeCatalog(): WardrobeItem[] {
  const metadataByStem = readMetadata()
  return collectWardrobeImages().map((relativePath) => {
    const parts = relativePath.split('/')
    const folderName = parts[1] || 'wardrobe'
    const fileStem = stripExtension(parts[parts.length - 1])
    const metadata = metadataByStem.get(fileStem)

    return {
      id: fileStem,
      name: inferDisplayName(metadata, fileStem),
      category: folderCategoryMap[folderName] ?? 'top',
      imagePath: '/' + relativePath,
      colors: metadata
        ? Array.from(new Set([...parseColorTokens(metadata.kurta_color), ...parseColorTokens(metadata.bottom_color)]))
        : [],
      styleTags: buildStyleTags(metadata, folderName),
      layerRole: 'base',
      garmentType: metadata?.garment_type,
      style: metadata?.style,
      bottomColor: metadata?.bottom_color,
      designDetails: metadata?.design_details,
      sourceImageFile: relativePath,
      localImagePath: '',
    }
  })
}

const handler: VercelApiHandler = async (_req, res) => {
  try {
    const items = loadWardrobeCatalog()
    res.json(items)
  } catch (error) {
    console.error('[wardrobe] Error:', error)
    res.status(500).json({ error: 'Failed to load wardrobe' })
  }
}

export default handler