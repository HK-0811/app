import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { loadWardrobeManifest } from '../server/lib/catalog'
import { loadWardrobeCatalog } from '../server/lib/wardrobeCatalog'

const wardrobeRoot = path.resolve('X:/codex/fashion_spin/wardrobe')
const publicWardrobeRoot = path.resolve('X:/codex/fashion_spin/public/wardrobe')
const manifestPath = path.join(publicWardrobeRoot, 'manifest.json')

describe('loadWardrobeCatalog', () => {
  it('loads the local wardrobe images and excludes the base character image', () => {
    const wardrobe = loadWardrobeCatalog(wardrobeRoot)

    expect(wardrobe.length).toBeGreaterThanOrEqual(5)
    expect(wardrobe.some((item) => item.id === 'base_img')).toBe(false)
  })

  it('maps metadata onto the matching kurta image by filename stem', () => {
    const wardrobe = loadWardrobeCatalog(wardrobeRoot)
    const maroonKurta = wardrobe.find(
      (item) => item.id === 'Gemini_Generated_Image_55d46355d46355d4'
    )

    expect(maroonKurta).toMatchObject({
      name: 'Brown Kurta',
      category: 'top',
      colors: ['maroon', 'beige'],
    })
    expect(maroonKurta?.styleTags).toContain('short-kurta')
    expect(maroonKurta?.designDetails).toContain('mandarin collar')
  })
})

describe('wardrobe manifest', () => {
  it('only includes wearable assets that exist in public/wardrobe', () => {
    const manifest = loadWardrobeManifest(manifestPath)
    const actualImages = fs
      .readdirSync(publicWardrobeRoot, { recursive: true })
      .filter((entry): entry is string => typeof entry === 'string')
      .filter((entry) => /\.(png|jpe?g|webp)$/i.test(entry))
      .filter((entry) => path.basename(entry).toLowerCase() !== 'base_img.png')
      .map((entry) => `/wardrobe/${entry.replace(/\\/g, '/')}`)
      .sort()

    const manifestImages = manifest.map((item) => item.imagePath).sort()

    expect(manifestImages).toEqual(actualImages)

    for (const item of manifest) {
      const localPath = path.join(path.resolve('X:/codex/fashion_spin/public'), item.imagePath.replace(/^\//, ''))
      expect(fs.existsSync(localPath)).toBe(true)
    }
  })
})
