export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for voice transcription.')
  }

  const formData = new FormData()
  formData.append(
    'file',
    new Blob([audioBuffer], { type: mimeType || 'audio/webm' }),
    fileName
  )
  formData.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'whisper-1')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Audio transcription failed.')
  }

  const result = (await response.json()) as { text?: string }
  if (!result.text) {
    throw new Error('Audio transcription returned no text.')
  }

  return result.text
}
