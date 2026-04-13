import { describe, expect, it } from 'vitest'
import type { WardrobeItem } from '../src/types'
import { selectLockerItems } from '../src/lib/api'

const wardrobe: WardrobeItem[] = [
  {
    id: 'brown-kurta',
    name: 'Brown Kurta',
    category: 'top',
    imagePath: '/wardrobe/items/brown-kurta.png',
    colors: ['brown', 'maroon'],
    styleTags: ['shaadi', 'festive', 'hero-look'],
    layerRole: 'base',
  },
  {
    id: 'cream-pajama',
    name: 'Cream Pajama',
    category: 'bottom',
    imagePath: '/wardrobe/items/cream-pajama.png',
    colors: ['cream'],
    styleTags: ['shaadi', 'festive', 'hero-look'],
    layerRole: 'base',
  },
  {
    id: 'midnight-polo',
    name: 'Midnight Polo',
    category: 'top',
    imagePath: '/wardrobe/items/midnight-polo.png',
    colors: ['navy'],
    styleTags: ['smart', 'date'],
    layerRole: 'base',
  },
]

describe('selectLockerItems', () => {
  it('returns only the hero look pieces for the locker reveal', () => {
    expect(selectLockerItems('Date at 7 pm', wardrobe)).toEqual([
      'brown-kurta',
      'cream-pajama',
    ])
  })
})
