import type { Occasion } from '../types'

export const occasions: Array<{
  id: Occasion
  label: string
  vibe: string
  prompt: string
}> = [
  {
    id: 'college',
    label: 'College Run',
    vibe: 'Low effort, high taste.',
    prompt: 'For when the attendance is shaky but the fit still needs to show up.',
  },
  {
    id: 'date',
    label: 'Date Night',
    vibe: 'Smooth, not try-hard.',
    prompt: 'Look like you planned it, even if the plan was made 12 minutes ago.',
  },
  {
    id: 'shaadi',
    label: 'Shaadi Mode',
    vibe: 'Family-approved, camera-ready.',
    prompt: 'You are one compliment away from stealing the group photo.',
  },
  {
    id: 'gym',
    label: 'Gym Session',
    vibe: 'Built for reps and mirror checks.',
    prompt: 'Clean, athletic, and ready for the post-workout coffee stop.',
  },
]
