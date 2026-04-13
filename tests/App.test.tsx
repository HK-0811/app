import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import type { MissionResult, WardrobeItem } from '../src/types'

const mockWardrobe: WardrobeItem[] = [
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
  {
    id: 'stone-chinos',
    name: 'Stone Chinos',
    category: 'bottom',
    imagePath: '/wardrobe/items/stone-chinos.png',
    colors: ['stone'],
    styleTags: ['smart', 'date'],
    layerRole: 'base',
  },
  {
    id: 'brown-loafers',
    name: 'Brown Loafers',
    category: 'shoes',
    imagePath: '/wardrobe/items/brown-loafers.png',
    colors: ['brown'],
    styleTags: ['date'],
    layerRole: 'base',
  },
]

const missionDone: MissionResult = {
  id: 'mission-1',
  stage: 'done',
  missionText: 'Date at 7 pm',
  selectedItems: ['brown-kurta', 'cream-pajama'],
  explanation: 'Sharp date-night look picked from the locker.',
  finalImageUrl: '/character/base.png',
  error: null,
}

const fetchWardrobe = vi.fn<[], Promise<WardrobeItem[]>>()
const createMission = vi.fn<[string, Blob | undefined], Promise<MissionResult>>()

vi.mock('../src/lib/api', () => ({
  fetchWardrobe: () => fetchWardrobe(),
  createMission: (text: string, audio?: Blob) => createMission(text, audio),
}))

describe('App', () => {
  beforeEach(() => {
    fetchWardrobe.mockResolvedValue(mockWardrobe)
    createMission.mockResolvedValue(missionDone)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts on the mission intro screen', async () => {
    render(<App />)

    await waitFor(() => {
      expect(fetchWardrobe).toHaveBeenCalled()
    })

    expect(
      screen.getByRole('button', { name: /start mission/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /kal kya pehnun/i })
    ).toBeInTheDocument()
  })

  it('opens the wardrobe drawer from the mission step and renders catalog items', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /start mission/i }))
    await user.click(screen.getByRole('button', { name: /open wardrobe/i }))

    expect(await screen.findByText(/your locker/i)).toBeInTheDocument()
    expect(screen.getByText(/midnight polo/i)).toBeInTheDocument()
    expect(screen.getByText(/brown loafers/i)).toBeInTheDocument()
  })

  it('submits a typed mission and reaches the final reveal', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /start mission/i }))

    await user.type(
      screen.getByRole('textbox'),
      'Date at 7 pm'
    )
    await user.click(screen.getByRole('button', { name: /send mission/i }))

    expect(
      await screen.findByRole('heading', { name: /this is the exact pull for your mission/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/sharp date-night look/i)).toBeInTheDocument()
    expect(screen.getByText(/brown kurta/i)).toBeInTheDocument()
    expect(screen.getByText(/cream pajama/i)).toBeInTheDocument()
    expect(screen.getByText(/mission pick/i)).toBeInTheDocument()
    expect(screen.queryByText(/midnight polo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/brown loafers/i)).not.toBeInTheDocument()

    await waitFor(() => {
      expect(createMission).toHaveBeenCalledWith('Date at 7 pm', undefined)
    })
  })
})
