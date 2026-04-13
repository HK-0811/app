import { wardrobeItems } from '../data/wardrobe'
import type { FitRequest, FitResult, Occasion, WardrobeItem } from '../types'

interface OccasionProfile {
  titleOptions: string[]
  reasoningTemplates: [string, string, string]
  oneLiners: string[]
  extra: string
  confidenceBase: number
  preferredTopTags: string[]
  preferredBottomTags: string[]
}

const profiles: Record<Occasion, OccasionProfile> = {
  college: {
    titleOptions: ['Fit locked for campus', 'Lecture hall, but make it stylish'],
    reasoningTemplates: [
      'College calls for something easy, so this pairing keeps it relaxed without looking sleepy.',
      'The colors stay clean and repeatable, which makes the outfit feel intentional, not accidental.',
      'You could wear this from class to chai without needing a mid-day wardrobe rescue.',
    ],
    oneLiners: [
      'College fit sorted. Even the backbench noticed.',
      'This is the kind of college look that says “group project MVP.”',
    ],
    extra: 'Finish with clean white sneakers and a half-zipped backpack.',
    confidenceBase: 84,
    preferredTopTags: ['college', 'easy', 'smart-casual'],
    preferredBottomTags: ['college', 'clean', 'day'],
  },
  date: {
    titleOptions: ['Fit locked for the date', 'Main character, table for two'],
    reasoningTemplates: [
      'Date night needs structure, and this combo lands in the sweet spot between polished and effortless.',
      'The palette feels calm and expensive, which makes the whole look read more confident.',
      'Nothing here is screaming for attention, and that is exactly why it works.',
    ],
    oneLiners: [
      'Date fit sorted. Keep the conversation as strong as the collar.',
      'This one says “I made an effort” without sending a press release.',
    ],
    extra: 'Add a watch and keep the shoes sharp. Let the fit do the flirting.',
    confidenceBase: 89,
    preferredTopTags: ['date', 'smart', 'clean'],
    preferredBottomTags: ['date', 'smart', 'tailored'],
  },
  shaadi: {
    titleOptions: ['Shaadi fit locked', 'Wedding season, handled properly'],
    reasoningTemplates: [
      'Shaadi dressing needs presence, and this pairing gives you celebration energy without drifting into costume.',
      'The contrast keeps the silhouette clean, so the look photographs well from stage lights to cousin selfies.',
      'It feels dressed up, but still easy enough to wear through the full round of meet-and-greets.',
    ],
    oneLiners: [
      'Shaadi fit ready. Aunties will approve, cousins will ask where it is from.',
      'This one walks in like it already knows the DJ queue is elite.',
    ],
    extra: 'Brown loafers or mojaris finish this properly. Skip the panic shopping.',
    confidenceBase: 92,
    preferredTopTags: ['shaadi', 'traditional', 'elevated'],
    preferredBottomTags: ['shaadi', 'tailored', 'sharp'],
  },
  gym: {
    titleOptions: ['Gym fit locked', 'Built for reps, not excuses'],
    reasoningTemplates: [
      'Gym style works best when it looks clean and athletic, and this pairing stays lean without trying too hard.',
      'The darker base keeps things sharp, while the top still gives you enough visual lift.',
      'It feels like someone who trains hard and still cares how the mirror selfie lands.',
    ],
    oneLiners: [
      'Gym fit sorted. PRs optional, aura mandatory.',
      'This one says you came to train, not just occupy the cable machine.',
    ],
    extra: 'Keep the sneakers performance-first and throw on a cap for the exit.',
    confidenceBase: 86,
    preferredTopTags: ['gym', 'sport', 'technical'],
    preferredBottomTags: ['gym', 'sport', 'easy'],
  },
}

function pickBestItem(
  items: WardrobeItem[],
  type: WardrobeItem['type'],
  preferredTags: string[],
  variant: number
) {
  const candidates = items.filter((item) => item.type === type)
  const scored = candidates
    .map((item) => ({
      item,
      score: item.styleTags.reduce(
        (total, tag) => total + (preferredTags.includes(tag) ? 2 : 0),
        0
      ),
    }))
    .sort((left, right) => right.score - left.score)

  return scored[variant % Math.max(scored.length, 1)]?.item ?? candidates[0]
}

function fallbackItem(type: WardrobeItem['type'], preferredTags: string[]) {
  return wardrobeItems.find(
    (item) =>
      item.type === type &&
      item.styleTags.some((tag) => preferredTags.includes(tag))
  )
}

export function generateFit(request: FitRequest, variant = 0): FitResult {
  const profile = profiles[request.occasion]
  const top =
    pickBestItem(wardrobeItems, 'top', profile.preferredTopTags, variant) ??
    fallbackItem('top', profile.preferredTopTags)
  const bottom =
    pickBestItem(wardrobeItems, 'bottom', profile.preferredBottomTags, variant) ??
    fallbackItem('bottom', profile.preferredBottomTags)

  if (!top || !bottom) {
    throw new Error('A top and bottom are required to build a fit.')
  }

  return {
    title: profile.titleOptions[variant % profile.titleOptions.length],
    topId: top.id,
    bottomId: bottom.id,
    reasoning: profile.reasoningTemplates.map((line, index) =>
      index === 0 ? line.replace('this pairing', `${request.occasion} calls for this pairing`) : line
    ),
    oneLiner: profile.oneLiners[variant % profile.oneLiners.length],
    confidence: Math.min(profile.confidenceBase + variant, 97),
    extra: profile.extra,
  }
}
