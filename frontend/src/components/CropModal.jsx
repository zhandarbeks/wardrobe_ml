import { useState, useEffect, useRef } from 'react'

const MIN_BOX = 40        // minimum crop side in display pixels
const MAX_DISPLAY = 520   // max image width/height shown in the modal

export default function CropModal({ file, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl]     = useState(null)
  const [imgSize, setImgSize]   = useState({ w: 0, h: 0 })
  const [natSize, setNatSize]   = useState({ w: 0, h: 0 })
  const [crop, setCrop]         = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [drag, setDrag]         = useState(null)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const probe = new Image()
    probe.onload = () => {
      const scale = Math.min(MAX_DISPLAY / probe.naturalWidth, MAX_DISPLAY / probe.naturalHeight, 1)
      const w = probe.naturalWidth  * scale
      const h = probe.naturalHeight * scale
      setImgSize({ w, h })
      setNatSize({ w: probe.naturalWidth, h: probe.naturalHeight })
      const cw = w * 0.8, ch = h * 0.8
      setCrop({ x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch })
    }
    probe.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const startDrag = (mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      base: { ...crop },
    })
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      setCrop((c) => {
        let { x, y, w, h } = drag.base
        if (drag.mode === 'move') {
          x = Math.max(0, Math.min(imgSize.w - w, x + dx))
          y = Math.max(0, Math.min(imgSize.h - h, y + dy))
        } else if (drag.mode === 'resize') {
          w = Math.max(MIN_BOX, Math.min(imgSize.w - x, w + dx))
          h = Math.max(MIN_BOX, Math.min(imgSize.h - y, h + dy))
        }
        return { x, y, w, h }
      })
    }
    const onUp = () => setDrag(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, imgSize.w, imgSize.h])

  const confirm = async () => {
    const sx = crop.x * (natSize.w / imgSize.w)
    const sy = crop.y * (natSize.h / imgSize.h)
    const sw = crop.w * (natSize.w / imgSize.w)
    const sh = crop.h * (natSize.h / imgSize.h)
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(sw)
    canvas.height = Math.round(sh)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
    onConfirm(blob)
  }

  if (!file) return null

  const dim = 'rgba(0,0,0,0.55)'
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 600 }}>
        <h3 style={{ margin: '0 0 12px' }}>Crop to your garment</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555' }}>
          Drag the box to move it. Drag the bottom-right corner to resize.
          Crop tightly around the single item — this dramatically improves recognition.
        </p>

        <div
          style={{
            position: 'relative', width: imgSize.w, height: imgSize.h,
            margin: '0 auto', userSelect: 'none', touchAction: 'none',
          }}
        >
          <img
            ref={imgRef}
            src={imgUrl}
            alt="to-crop"
            draggable={false}
            style={{ width: imgSize.w, height: imgSize.h, display: 'block' }}
          />

          {/* 4 dim rectangles outside the crop */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: '100%',
                        height: crop.y, background: dim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, top: crop.y + crop.h,
                        width: '100%', height: imgSize.h - (crop.y + crop.h),
                        background: dim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, top: crop.y,
                        width: crop.x, height: crop.h, background: dim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: crop.x + crop.w, top: crop.y,
                        width: imgSize.w - (crop.x + crop.w), height: crop.h,
                        background: dim, pointerEvents: 'none' }} />

          {/* The crop box itself — drag to move */}
          <div
            onPointerDown={startDrag('move')}
            style={{
              position: 'absolute', left: crop.x, top: crop.y,
              width: crop.w, height: crop.h,
              border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
              cursor: 'move',
            }}
          >
            {/* SE resize handle */}
            <div
              onPointerDown={startDrag('resize')}
              style={{
                position: 'absolute', right: -8, bottom: -8,
                width: 16, height: 16, background: '#fff',
                border: '1px solid #333', cursor: 'nwse-resize',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={confirm}>Use Cropped Photo</button>
        </div>
      </div>
    </div>
  )
}
