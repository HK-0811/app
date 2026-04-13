import type { VercelApiHandler, VercelRequest } from '@vercel/node'

const handler: VercelApiHandler = async (req: VercelRequest, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
    return
  }

  try {
    const formData = (req as any).formData()
    const audioFile = formData.get('audio') as File | null
    
    if (!audioFile) {
      res.status(400).json({ error: 'No audio file provided' })
      return
    }

    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const audioBase64 = buffer.toString('base64')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'FashionSpin',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-audio-preview',
        modalities: ['text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe this audio exactly as spoken.' },
              { type: 'input_audio', input_audio: { data: audioBase64, format: 'wav' } },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[transcribe] OpenRouter error:', errorText)
      res.status(500).json({ error: 'Failed to transcribe audio' })
      return
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content || ''
    res.json({ text: content })
  } catch (error) {
    console.error('[transcribe] Exception:', error)
    res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}

export default handler