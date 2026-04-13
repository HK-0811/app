import fs from 'fs'
import path from 'path'
import type { WardrobeItem } from './types'

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

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const folderCategoryMap: Record<string, WardrobeItem['category']> = {
  kurtas: 'top',
  tshirts: 'top',
  bottoms: 'bottom',
  shoes: 'shoes',
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripExtension(fileName: string) {
  return path.parse(fileName).name
}

function readMetadata(wardrobeRoot: string) {
  const metadataPath = path.join(wardrobeRoot, 'clothing_metadata.json')
  if (!fs.existsSync(metadataPath)) {
    return new Map<string, ClothingMetadataEntry>()
  }

  const document = JSON.parse(
    fs.readFileSync(metadataPath, 'utf-8')
  ) as ClothingMetadataDocument

  return new Map(
    document.clothing_metadata.map((entry) => [
      stripExtension(entry.image_file),
      entry,
    ])
  )
}

function collectWardrobeImages(root: string) {
  const images: string[] = []

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (!imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        continue
      }

      if (stripExtension(entry.name) === 'base_img') {
        continue
      }

      images.push(fullPath)
    }
  }

  walk(root)
  return images
}

function parseColorTokens(value: string) {
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

function inferDisplayName(metadata: ClothingMetadataEntry | undefined, fileStem: string) {
  if (!metadata) {
    return fileStem.replace(/[-_]+/g, ' ')
  }

  if (metadata.garment_type.toLowerCase() === 'kurta set') {
    const primaryColor = metadata.kurta_color.toLowerCase().includes('maroon')
      ? 'Brown'
      : metadata.kurta_color.split(/[\s,(]/)[0]

    return `${primaryColor} Kurta`
  }

  return metadata.garment_type
}

function buildStyleTags(
  metadata: ClothingMetadataEntry | undefined,
  folderName: string
) {
  const tags = [folderName]
  if (!metadata) {
    return tags
  }

  tags.push(slugify(metadata.garment_type))
  tags.push(slugify(metadata.style))
  parseColorTokens(metadata.kurta_color).forEach((token) => tags.push(token))
  parseColorTokens(metadata.bottom_color).forEach((token) => tags.push(token))

  return Array.from(new Set(tags.filter(Boolean)))
}

export function loadWardrobeCatalog(wardrobeRoot: string): WardrobeItem[] {
  const metadataByStem = readMetadata(wardrobeRoot)

  return collectWardrobeImages(wardrobeRoot).map((fullPath) => {
    const relativePath = path.relative(wardrobeRoot, fullPath).replace(/\\/g, '/')
    const folderName = relativePath.split('/')[0] ?? 'wardrobe'
    const fileStem = stripExtension(path.basename(fullPath))
    const metadata = metadataByStem.get(fileStem)

    return {
      id: fileStem,
      name: inferDisplayName(metadata, fileStem),
      category: folderCategoryMap[folderName] ?? 'top',
      imagePath: `/wardrobe/${relativePath}`,
      localImagePath: fullPath,
      sourceImageFile: path.basename(fullPath),
      colors: metadata
        ? Array.from(
            new Set([
              ...parseColorTokens(metadata.kurta_color),
              ...parseColorTokens(metadata.bottom_color),
            ])
          )
        : [],
      styleTags: buildStyleTags(metadata, folderName),
      layerRole: 'base',
      garmentType: metadata?.garment_type,
      style: metadata?.style,
      bottomColor: metadata?.bottom_color,
      designDetails: metadata?.design_details,
    }
  })
}

export function getBaseImagePath(wardrobeRoot: string) {
  return path.join(wardrobeRoot, 'base_img.png')
}
