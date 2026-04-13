import { useState, useRef } from 'react'

interface DetectedMetadata {
  garment_type: string
  style: string
  color: string
  design_details: string
}

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (item: { image: string; metadata: DetectedMetadata }) => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function detectCategory(garmentType: string): WardrobeItem['category'] {
  const type = garmentType.toLowerCase()
  if (type.includes('kurta') || type.includes('shirt') || type.includes('tshirt') || 
      type.includes('t-shirt') || type.includes('sherwani') || type.includes('jacket')) {
    return 'top'
  }
  if (type.includes('jeans') || type.includes('pant') || type.includes('trouser') || 
      type.includes('churidar') || type.includes('pyjama')) {
    return 'bottom'
  }
  if (type.includes('shoe') || type.includes('sandel') || type.includes('mojaris')) {
    return 'shoes'
  }
  return 'top'
}

function inferDisplayName(metadata: DetectedMetadata): string {
  const parts = [metadata.color, metadata.garment_type].filter(Boolean)
  return parts.join(' ') || 'New Item'
}

export function AddClothing({ open, onClose, onAdd }: Props) {
  const [image, setImage] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result as string)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleDetect = async () => {
    if (!image) return

    setDetecting(true)
    setError(null)

    try {
      const base64 = image.split(',')[1]
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('image', blob, 'image.jpg')

      const res = await fetch('/api/wardrobe/detect', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to detect')
      }

      const data = await res.json()
      const metadata = data.metadata as DetectedMetadata

      const category = detectCategory(metadata.garment_type)
      const name = inferDisplayName(metadata)

      setSaving(true)
      onAdd({
        image,
        metadata: {
          ...metadata,
          color: metadata.color || 'Unknown',
          design_details: metadata.design_details || '',
        },
      })
      onClose()
    } catch (err) {
      console.error('Detect failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to detect clothing')
    } finally {
      setDetecting(false)
      setSaving(false)
    }
  }

  const handleOpenCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.capture = 'environment'
      fileInputRef.current.click()
    }
  }

  const handleOpenGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture')
      fileInputRef.current.click()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>ADD TO WARDROBE</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {!image ? (
            <div className="add-options">
              <button className="add-option-btn" onClick={handleOpenCamera}>
                <span className="add-icon">📷</span>
                <span>Take Photo</span>
              </button>
              <button className="add-option-btn" onClick={handleOpenGallery}>
                <span className="add-icon">🖼️</span>
                <span>Choose from Gallery</span>
              </button>
            </div>
          ) : (
            <div className="preview-section">
              <img src={image} alt="Preview" className="preview-image" />
              <div className="preview-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setImage(null)}
                  disabled={detecting || saving}
                >
                  Change Photo
                </button>
                <button
                  className="btn-primary"
                  onClick={handleDetect}
                  disabled={!image || detecting || saving}
                >
                  {detecting ? 'Detecting...' : saving ? 'Saving...' : 'Add to Wardrobe'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="modal-error">{error}</p>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelectImage}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}

type WardrobeItem = import('../types').WardrobeItem
