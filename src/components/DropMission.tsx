import { useState, useRef } from 'react'
import { transcribeAudio } from '../lib/api'
import type { MissionInput } from '../types'

interface Props {
  onSubmit: (input: MissionInput) => void
  onOpenWardrobe: () => void
  error: string | null
}

async function convertWebmToWav(webmBlob: Blob): Promise<Blob> {
  const arrayBuffer = await webmBlob.arrayBuffer()
  const audioContext = new AudioContext()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  const wavBuffer = audioBufferToWav(audioBuffer)
  audioContext.close()
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample

  const samples = buffer.length
  const dataSize = samples * blockAlign
  const bufferSize = 44 + dataSize

  const arrayBuffer = new ArrayBuffer(bufferSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, bufferSize - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels = []
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return arrayBuffer
}

const quickPrompts = [
  'Date at 7 pm, polished but not loud',
  'College presentation, easy and sharp',
  'Shaadi function, festive and elevated',
]

export function DropMission({ onSubmit, onOpenWardrobe, error }: Props) {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        await processAudio(audioBlob)
      }

      mediaRecorder.start()
      setRecording(true)
    } catch {
      console.error('Failed to start recording')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setTranscribing(true)
    try {
      const wavBlob = await convertWebmToWav(audioBlob)
      const { text: transcribed } = await transcribeAudio(wavBlob)
      setText((prev) => (prev ? `${prev} ${transcribed}` : transcribed))
    } catch (err) {
      console.error('Transcription failed:', err)
    } finally {
      setTranscribing(false)
    }
  }

  const handleSubmit = () => {
    if (!text.trim()) {
      return
    }

    onSubmit({
      text: text.trim(),
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="step step-mission">
      <div className="atelier-bar">
        <span className="atelier-mark">Mission desk</span>
        <button className="text-link" onClick={onOpenWardrobe} type="button">
          Open Wardrobe
        </button>
      </div>

      <div className="mission-panel">
        <p className="step-label">Step 02</p>
        <h2 className="mission-title">Describe tomorrow in one line.</h2>
        <p className="mission-sub">
          We will read the occasion, pull the closest pieces from your wardrobe, and return two flat outfit boards.
        </p>

        <textarea
          className="mission-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Date at 7 pm. I want something clean, warm, and a little dressed up."
          rows={4}
        />

        <div className="mission-chips">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              className="mission-chip"
              type="button"
              onClick={() => setText(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mission-actions">
          <button
            className={`btn-record ${recording ? 'recording' : ''}`}
            onClick={recording ? stopRecording : startRecording}
            type="button"
            disabled={transcribing}
          >
            {transcribing ? 'Transcribing...' : recording ? 'Stop Recording' : 'Use Voice'}
          </button>

          <button
            className="btn-secondary"
            onClick={onOpenWardrobe}
            type="button"
          >
            View Wardrobe
          </button>

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!text.trim() || transcribing}
          >
            Send Mission
          </button>
        </div>

        {error && <p className="mission-error">{error}</p>}
      </div>

      <section className="mission-notes">
        <article>
          <span>Output</span>
          <strong>Two option cards</strong>
          <p>Editorial product boards with matched pieces and reasoning.</p>
        </article>
        <article>
          <span>Visual rule</span>
          <strong>No people in the UI</strong>
          <p>Only flat garment imagery, material details, and styling notes.</p>
        </article>
      </section>
    </div>
  )
}
