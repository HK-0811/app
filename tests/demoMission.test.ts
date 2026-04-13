import path from 'path'
import { describe, expect, it } from 'vitest'
import { loadWardrobeCatalog } from '../server/lib/wardrobeCatalog'

const wardrobeRoot = path.resolve('X:/codex/fashion_spin/wardrobe')

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
