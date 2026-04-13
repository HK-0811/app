import type { MissionResult, WardrobeItem } from '../types'

const API = '/api'

function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

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
): Promise<MissionResult> {
  const body: Record<string, unknown> = {}
  if (text?.trim()) {
    body.text = text.trim()
  }
  if (audio) {
    const arrayBuffer = await audio.arrayBuffer()
    body.audio = arrayBufferToBase64(arrayBuffer)
    body.audioType = audio.type
  }

  const res = await fetch(`${API}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error('Failed to create mission')
  }

  return res.json()
}

export async function transcribeAudio(audio: Blob): Promise<{ text: string }> {
  const formData = new FormData()
  formData.append('audio', audio, 'audio.wav')

  const res = await fetch(`${API}/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('Failed to transcribe audio')
  }

  return res.json()
}

export async function saveWardrobeMetadata(
  metadata: { garment_type: string; style: string; color: string; design_details: string },
  fileName?: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API}/wardrobe-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata, fileName }),
  })

  if (!res.ok) {
    throw new Error('Failed to save wardrobe metadata')
  }

  return res.json()
}
