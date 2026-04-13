import type { MissionResult, WardrobeItem } from '../types'

const API = '/api'

export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  const res = await fetch(`${API}/wardrobe`)
  if (!res.ok) {
    throw new Error('Failed to load wardrobe')
  }
  return res.json()
}

export async function createMission(
  text?: string,
  audio?: Blob
): Promise<{ id: string }> {
  const formData = new FormData()
  if (text?.trim()) {
    formData.append('text', text.trim())
  }
  if (audio) {
    formData.append('audio', audio, 'mission.webm')
  }

  const res = await fetch(`${API}/missions`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('Failed to create mission')
  }

  return res.json()
}

export async function getMission(id: string): Promise<MissionResult> {
  const res = await fetch(`${API}/missions/${id}`)
  if (!res.ok) {
    throw new Error('Mission not found')
  }
  return res.json()
}

export async function transcribeAudio(audio: Blob): Promise<{ text: string }> {
  const formData = new FormData()
  formData.append('audio', audio, 'audio.webm')

  const res = await fetch(`${API}/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('Failed to transcribe audio')
  }

  return res.json()
}

export function pollMission(id: string, onUpdate: (m: MissionResult) => void): () => void {
  let active = true

  const poll = async () => {
    while (active) {
      try {
        const mission = await getMission(id)
        onUpdate(mission)
        if (mission.stage === 'done' || mission.stage === 'error') {
          break
        }
      } catch {
        // Keep polling during transient startup issues.
      }

      await new Promise((resolve) => setTimeout(resolve, 900))
    }
  }

  void poll()

  return () => {
    active = false
  }
}

export async function saveWardrobeMetadata(
  metadata: { garment_type: string; style: string; color: string; design_details: string },
  fileName?: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API}/wardrobe/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata, fileName }),
  })

  if (!res.ok) {
    throw new Error('Failed to save wardrobe metadata')
  }

  return res.json()
}
