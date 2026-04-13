import type { VercelApiHandler, VercelRequest } from '@vercel/node'

const handler: VercelApiHandler = async (req: VercelRequest, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
    return
  }

  try {
    const formData = (req as any).formData()
    const imageFile = formData.get('image') as File | null
    
    if (!imageFile) {
      res.status(400).json({ error: 'No image file provided' })
      return
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const imageBase64 = buffer.toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${imageBase64}`

    console.log('[wardrobe-detect] Sending image to AI for detection')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'FashionSpin',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a fashion expert. Analyze the clothing image and return a JSON object with exactly these fields: ' +
              'garment_type (like Kurta, T-shirt, Jeans, Sherwani), ' +
              'style (specific style description), ' +
              'color (main color(s)), ' +
              'design_details (notable design elements). ' +
              'Return ONLY valid JSON, no markdown or code blocks.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this clothing image and describe it with JSON.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[wardrobe-detect] OpenRouter error:', errorText)
      res.status(500).json({ error: 'Failed to detect clothing metadata' })
      return
    }

    const result = await response.json()
    let content = result?.choices?.[0]?.message?.content || '{}'

    // Clean up markdown-wrapped JSON
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```')) {
      const match = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) cleanContent = match[1].trim()
    }

    let metadata
    try {
      metadata = JSON.parse(cleanContent)
    } catch {
      metadata = {
        garment_type: 'Unknown',
        style: 'Unknown',
        color: 'Unknown',
        design_details: cleanContent.slice(0, 100),
      }
    }

    console.log('[wardrobe-detect] Detected:', metadata)
    res.json({ metadata, image: dataUrl })
  } catch (error) {
    console.error('[wardrobe-detect] Exception:', error)
    res.status(500).json({ error: 'Failed to detect clothing metadata' })
  }
}

export default handler