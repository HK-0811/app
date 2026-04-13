import type { ViteDevServer } from 'vite'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { loadWardrobeManifest } from './server/lib/catalog'
import { loadLocalEnv } from './server/lib/loadEnv'
import { createMissionResult } from './server/lib/missionService'

const wardrobeRoot = path.join(path.resolve('public'), 'wardrobe')
const manifestPath = path.join(wardrobeRoot, 'manifest.json')

export function expressPlugin() {
  return {
    name: 'express-plugin',
    configureServer(server: ViteDevServer) {
      const app = express()
      const upload = multer({ storage: multer.memoryStorage() })
      loadLocalEnv(process.cwd())

      app.use(cors())
      app.use(express.json())

      app.get('/api/wardrobe', (_req, res) => {
        res.json(loadWardrobeManifest(manifestPath))
      })

      app.post('/api/missions', async (req, res) => {
        const missionText =
          typeof req.body.text === 'string' ? req.body.text.trim() : ''

        if (!missionText) {
          res.status(400).json({ error: 'Provide text to start the mission.' })
          return
        }

        try {
          const mission = await createMissionResult({
            missionText,
            wardrobeRoot,
            assetSourceMode: 'file',
          })

          res.json(mission)
        } catch (error) {
          console.error('[Mission] Error:', error)
          res.status(500).json({ error: 'Failed to create mission.' })
        }
      })

      app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
        const audioFile = req.file

        if (!audioFile) {
          res.status(400).json({ error: 'No audio file provided' })
          return
        }

        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) {
          res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
          return
        }

        try {
          const audioBase64 = audioFile.buffer.toString('base64')
          console.log('[Transcribe] Sending request to OpenRouter')

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
              'X-Title': process.env.OPENROUTER_APP_NAME ?? 'FashionSpin',
            },
            body: JSON.stringify({
              model: 'openai/gpt-4o-audio-preview',
              modalities: ['text'],
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Transcribe this audio exactly as spoken.',
                    },
                    {
                      type: 'input_audio',
                      input_audio: {
                        data: audioBase64,
                        format: 'wav',
                      },
                    },
                  ],
                },
              ],
            }),
          })

          const responseText = await response.text()
          console.log('[Transcribe] Response status:', response.status)

          if (!response.ok) {
            console.error('[Transcribe] OpenRouter error:', responseText)
            res.status(500).json({ error: `Failed to transcribe audio: ${responseText.slice(0, 200)}` })
            return
          }

          let result
          try {
            result = JSON.parse(responseText)
          } catch {
            console.error('[Transcribe] Invalid JSON:', responseText)
            res.status(500).json({ error: 'Invalid response from transcription service' })
            return
          }

          let text = ''
          const messageContent = result?.choices?.[0]?.message?.content
          if (typeof messageContent === 'string') {
            text = messageContent
          } else if (Array.isArray(messageContent)) {
            text = messageContent
              .filter((c: unknown) => typeof c === 'object' && c !== null && 'type' in c && (c as Record<string, unknown>).type === 'text')
              .map((c: unknown) => (c as Record<string, unknown>).text as string)
              .join('')
          }
          console.log('[Transcribe] Got text:', text || '(empty)')
          res.json({ text })
        } catch (err) {
          console.error('[Transcribe] Exception:', err)
          res.status(500).json({ error: 'Failed to transcribe audio' })
        }
      })

      app.post('/api/wardrobe-detect', upload.single('image'), async (req, res) => {
        const imageFile = req.file
        if (!imageFile) {
          res.status(400).json({ error: 'No image file provided' })
          return
        }

        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) {
          res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
          return
        }

        try {
          const imageBuffer = imageFile.buffer
          const imageBase64 = Buffer.from(imageBuffer).toString('base64')
          const mimeType = imageFile.mimetype || 'image/jpeg'
          const dataUrl = `data:${mimeType};base64,${imageBase64}`

          console.log('[Wardrobe Detect] Sending image to AI for detection')

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
              'X-Title': process.env.OPENROUTER_APP_NAME ?? 'FashionSpin',
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
                    'Return ONLY valid JSON, no markdown.',
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Analyze this clothing image and describe it with JSON with keys: garment_type, style, color, design_details. Return ONLY valid JSON, no markdown or code blocks.',
                    },
                    {
                      type: 'image_url',
                      image_url: { url: dataUrl },
                    },
                  ],
                },
              ],
              temperature: 0.2,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('[Wardrobe Detect] OpenRouter error:', errorText)
            res.status(500).json({ error: 'Failed to detect clothing metadata' })
            return
          }

          const result = await response.json()
          const content = result?.choices?.[0]?.message?.content ?? '{}'

          let cleanContent = content.trim()
          if (cleanContent.startsWith('```')) {
            const jsonMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (jsonMatch) {
              cleanContent = jsonMatch[1].trim()
            } else {
              cleanContent = cleanContent.replace(/```[\s\S]*?```/, '').trim()
            }
          }

          let metadata
          try {
            metadata = JSON.parse(cleanContent)
          } catch {
            console.error('[Wardrobe Detect] Parse failed, content:', cleanContent.slice(0, 200))
            metadata = {
              garment_type: 'Unknown',
              style: 'Unknown',
              color: 'Unknown',
              design_details: cleanContent.slice(0, 100),
            }
          }

          console.log('[Wardrobe Detect] Detected:', metadata)
          res.json({ metadata, image: dataUrl })
        } catch (err) {
          console.error('[Wardrobe Detect] Exception:', err)
          res.status(500).json({ error: 'Failed to detect clothing metadata' })
        }
      })

      app.post('/api/wardrobe-save', async (req, res) => {
        const { metadata, fileName } = req.body

        if (!metadata) {
          res.status(400).json({ error: 'Missing metadata' })
          return
        }

        try {
          const metadataPath = path.join(wardrobeRoot, 'clothing_metadata.json')
          let existingData: { clothing_metadata: unknown[] } = { clothing_metadata: [] }

          if (fs.existsSync(metadataPath)) {
            existingData = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
          }

          const baseFileName = typeof fileName === 'string' && fileName 
            ? fileName.replace(/\.[^/.]+$/, '')
            : `user_${Date.now()}`

          const newEntry = {
            image_file: `${baseFileName}.jpg`,
            garment_type: metadata.garment_type || 'Unknown',
            style: metadata.style || 'Unknown',
            kurta_color: metadata.color || 'Unknown',
            bottom_color: 'Unknown',
            design_details: metadata.design_details || '',
          }

          existingData.clothing_metadata.push(newEntry)
          fs.writeFileSync(metadataPath, JSON.stringify(existingData, null, 2))

          console.log('[Wardrobe Save] Added:', newEntry)
          res.json({ success: true, entry: newEntry })
        } catch (err) {
          console.error('[Wardrobe Save] Error:', err)
          res.status(500).json({ error: 'Failed to save metadata' })
        }
      })

      server.middlewares.use(app)
    },
  }
}
