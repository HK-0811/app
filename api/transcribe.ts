import type { VercelApiHandler } from '@vercel/node'

const handler: VercelApiHandler = async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    console.error('[transcribe] OPENROUTER_API_KEY not configured')
    res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
    return
  }

  try {
    const body = req.body as { audio?: string; type?: string }
    
    if (!body?.audio) {
      res.status(400).json({ error: 'No audio provided' })
      return
    }

    const audioBase64 = body.audio
    const audioType = body.type || 'audio/webm'

    console.log('[transcribe] Sending request to OpenRouter')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://fashionspin.vercel.app',
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
    
    console.log('[transcribe] Success, content:', content.substring(0, 50))
    res.json({ text: content })
  } catch (error) {
    console.error('[transcribe] Exception:', error)
    res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}

export default handler