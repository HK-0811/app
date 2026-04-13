import type { OutfitDecision, WardrobeItem } from './types'

function findById(id: string, wardrobe: WardrobeItem[]) {
  return wardrobe.find((item) => item.id === id)
}

function keepExisting(ids: string[], wardrobe: WardrobeItem[]) {
  return ids.filter((id) => Boolean(findById(id, wardrobe)))
}

export function pickFallbackOutfit(
  missionText: string,
  wardrobe: WardrobeItem[]
): OutfitDecision {
  const text = missionText.toLowerCase()

  let selectedItems = ['black-tee', 'dark-jeans', 'white-sneakers']
  let vibe = 'clean and versatile'

  if (/shaadi|wedding|sangeet|mehendi|ceremony|reception/.test(text)) {
    selectedItems = [
      'cream-kurta',
      'charcoal-trousers',
      'brown-loafers',
      'silver-watch',
    ]
    vibe = 'shaadi-ready and elevated'
  } else if (/date|dinner|romantic|night|bar|club/.test(text)) {
    selectedItems = [
      'midnight-polo',
      'stone-chinos',
      'brown-loafers',
      'silver-watch',
    ]
    vibe = 'smooth and confident'
  } else if (/gym|workout|training|run|sports?/.test(text)) {
    selectedItems = [
      'training-tank',
      'black-joggers',
      'training-shoes',
      'black-cap',
    ]
    vibe = 'athletic and sharp'
  } else if (/college|campus|class|casual|hangout/.test(text)) {
    selectedItems = ['mint-tee', 'dark-jeans', 'white-sneakers', 'black-cap']
    vibe = 'fresh and easy'
  } else if (/office|formal|meeting|interview/.test(text)) {
    selectedItems = [
      'white-shirt',
      'charcoal-trousers',
      'brown-loafers',
      'silver-watch',
    ]
    vibe = 'professional and polished'
  }

  const exactIds = keepExisting(selectedItems, wardrobe)
  const chosenNames = exactIds
    .map((id) => findById(id, wardrobe)?.name)
    .filter(Boolean)
    .join(', ')

  return {
    selectedItems: exactIds,
    explanation: `Built a ${vibe} look for "${missionText}" using exact locker pieces: ${chosenNames}.`,
  }
}
