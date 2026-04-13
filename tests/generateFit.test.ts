import { describe, expect, it } from 'vitest'
import { pickFallbackOutfit } from '../server/lib/fallbackStylist'
import type { WardrobeItem } from '../server/lib/types'

const wardrobe: WardrobeItem[] = [
  {
    id: 'cream-kurta',
    name: 'Cream Kurta',
    category: 'top',
    imagePath: '/wardrobe/items/cream-kurta.png',
    colors: ['cream'],
    styleTags: ['shaadi', 'festive'],
    layerRole: 'base',
  },
  {
    id: 'charcoal-trousers',
    name: 'Charcoal Trousers',
    category: 'bottom',
    imagePath: '/wardrobe/items/charcoal-trousers.png',
    colors: ['charcoal'],
    styleTags: ['shaadi', 'formal'],
    layerRole: 'base',
  },
  {
    id: 'brown-loafers',
    name: 'Brown Loafers',
    category: 'shoes',
    imagePath: '/wardrobe/items/brown-loafers.png',
    colors: ['brown'],
    styleTags: ['shaadi', 'date'],
    layerRole: 'base',
  },
  {
    id: 'silver-watch',
    name: 'Silver Watch',
    category: 'accessory',
    imagePath: '/wardrobe/items/silver-watch.png',
    colors: ['silver'],
    styleTags: ['shaadi', 'date'],
    layerRole: 'accessory',
  },
]

describe('pickFallbackOutfit', () => {
  it('selects an exact festive outfit from the wardrobe manifest for a shaadi mission', () => {
    const result = pickFallbackOutfit('Going to a shaadi this weekend', wardrobe)

    expect(result.selectedItems).toEqual([
      'cream-kurta',
      'charcoal-trousers',
      'brown-loafers',
      'silver-watch',
    ])
    expect(result.explanation.toLowerCase()).toContain('shaadi')
  })

  it('only returns garment ids that exist in the manifest', () => {
    const result = pickFallbackOutfit('Date night dinner', wardrobe)

    expect(
      result.selectedItems.every((id) => wardrobe.some((item) => item.id === id))
    ).toBe(true)
  })
})
