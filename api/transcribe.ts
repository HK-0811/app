import type { VercelApiHandler } from '@vercel/node'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage() })

function runMiddleware(
  req: Parameters<VercelApiHandler>[0],
  res: Parameters<VercelApiHandler>[1],
  fn: (req: Parameters<VercelApiHandler>[0], res: Parameters<VercelApiHandler>[1], next: (error?: unknown) => void) => void
) {
  return new Promise<void>((resolve, reject) => {
    fn(req, res, (error?: unknown) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

const handler: VercelApiHandler = async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    console.error('[transcribe] OPENROUTER_API_KEY not configured')
    res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
    return
  }

  try {
    await runMiddleware(req, res, upload.single('audio'))

    const audioFile = (req as typeof req & { file?: Express.Multer.File }).file

    if (!audioFile) {
      res.status(400).json({ error: 'No audio file provided' })
      return
    }

    const audioBase64 = audioFile.buffer.toString('base64')

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
