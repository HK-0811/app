import fs from 'fs'
import path from 'path'
import type { WardrobeItem } from './types'

export function loadWardrobeManifest(manifestPath: string): WardrobeItem[] {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as WardrobeItem[]
}

export function summarizeWardrobe(wardrobe: WardrobeItem[]) {
  return wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    colors: item.colors,
    styleTags: item.styleTags,
    layerRole: item.layerRole,
  }))
}

export function resolveWardrobeItems(ids: string[], wardrobe: WardrobeItem[]) {
  return ids
    .map((id) => wardrobe.find((item) => item.id === id))
    .filter((item): item is WardrobeItem => Boolean(item))
}

export function toDataUrlFromImage(publicRoot: string, imagePath: string) {
  const localPath = path.join(publicRoot, imagePath.replace(/^\//, ''))
  const buffer = fs.readFileSync(localPath)
  const extension = path.extname(localPath).slice(1) || 'png'
  return `data:image/${extension};base64,${buffer.toString('base64')}`
}

export function writeImageDataUrl(outputPath: string, dataUrl: string) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Unsupported image payload received from image generation provider.')
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, Buffer.from(match[2], 'base64'))
}
