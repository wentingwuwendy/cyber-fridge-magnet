'use client'

import { useRef, useEffect, useState } from 'react'

const FRIDGE_W = 900
const FRIDGE_H = 1600
const MAGNET_BASE = 140

interface Magnet {
  id: number
  location: string
  created_at: string | null
  pos_x: number
  pos_y: number
  scale: number
  note: string | null
  lat: number | null
  lng: number | null
  image_url: string | null
}

interface FridgeCanvasProps {
  magnets: Magnet[]
  fridgeImage: string
  onUpdate: (id: number, posX: number, posY: number, scale: number) => void
  onDelete: (id: number) => void
  onHover: (m: Magnet | null) => void
  hoveredMagnet: Magnet | null
}

export default function FridgeCanvas({ magnets, fridgeImage, onUpdate, onDelete, onHover, hoveredMagnet }: FridgeCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const transform = useRef({ tx: 0, ty: 0, zoom: 0.5 })
  const isPanning = useRef(false)
  const panStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 })
  const pinchStart = useRef<{ dist: number; cx: number; cy: number; zoom: number; tx: number; ty: number } | null>(null)
  const touchOnMagnet = useRef(false)

  const getConstrainedTx = (tx: number, zoom: number) => {
    const vp = viewportRef.current
    if (!vp) return tx
    const vw = vp.offsetWidth
    const fridgeW = FRIDGE_W * zoom
    if (fridgeW <= vw) return (vw - fridgeW) / 2
    return Math.min(0, Math.max(vw - fridgeW, tx))
  }

  const applyTransform = () => {
    if (!canvasRef.current) return
    const { ty, zoom } = transform.current
    const tx = getConstrainedTx(transform.current.tx, zoom)
    transform.current.tx = tx
    canvasRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`
  }

  // Auto-fit on mount
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const vw = vp.offsetWidth
    const vh = vp.offsetHeight
    const initZoom = Math.min(vw / FRIDGE_W * 0.88, vh / FRIDGE_H * 0.92, 0.65)
    const tx = (vw - FRIDGE_W * initZoom) / 2
    const ty = Math.max(20, (vh - FRIDGE_H * initZoom) / 2)
    transform.current = { tx, ty, zoom: initZoom }
    applyTransform()
  }, [])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const vp = viewportRef.current
    if (!vp) return
    const { tx, ty, zoom } = transform.current
    const newZoom = Math.max(0.12, Math.min(4.0, zoom + (e.deltaY > 0 ? -0.08 : 0.08)))
    const vpRect = vp.getBoundingClientRect()
    const mx = e.clientX - vpRect.left
    const my = e.clientY - vpRect.top
    const s = newZoom / zoom
    transform.current = { tx: mx - s * (mx - tx), ty: my - s * (my - ty), zoom: newZoom }
    applyTransform()
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-magnet-id]')) return
    e.preventDefault()
    isPanning.current = true
    panStart.current = { mx: e.clientX, my: e.clientY, tx: transform.current.tx, ty: transform.current.ty }

    const onMM = (e: MouseEvent) => {
      if (!isPanning.current) return
      transform.current.tx = panStart.current.tx + e.clientX - panStart.current.mx
      transform.current.ty = panStart.current.ty + e.clientY - panStart.current.my
      applyTransform()
    }
    const onMU = () => {
      isPanning.current = false
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
    }
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const target = (e.target as HTMLElement).closest('[data-magnet-id]')
    if (target) { touchOnMagnet.current = true; return }
    touchOnMagnet.current = false

    if (e.touches.length === 1) {
      const t = e.touches[0]
      isPanning.current = true
      panStart.current = { mx: t.clientX, my: t.clientY, tx: transform.current.tx, ty: transform.current.ty }
    } else if (e.touches.length === 2) {
      isPanning.current = false
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const cx = (t0.clientX + t1.clientX) / 2
      const cy = (t0.clientY + t1.clientY) / 2
      const vp = viewportRef.current!
      const vpRect = vp.getBoundingClientRect()
      pinchStart.current = { dist, cx: cx - vpRect.left, cy: cy - vpRect.top, zoom: transform.current.zoom, tx: transform.current.tx, ty: transform.current.ty }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchOnMagnet.current) return
    e.preventDefault()
    if (e.touches.length === 1 && isPanning.current) {
      const t = e.touches[0]
      transform.current.tx = panStart.current.tx + t.clientX - panStart.current.mx
      transform.current.ty = panStart.current.ty + t.clientY - panStart.current.my
      applyTransform()
    } else if (e.touches.length === 2 && pinchStart.current) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const newZoom = Math.max(0.12, Math.min(4.0, pinchStart.current.zoom * dist / pinchStart.current.dist))
      const s = newZoom / pinchStart.current.zoom
      const { cx, cy, tx, ty } = pinchStart.current
      transform.current = { tx: cx - s * (cx - tx), ty: cy - s * (cy - ty), zoom: newZoom }
      applyTransform()
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      isPanning.current = false
      pinchStart.current = null
      touchOnMagnet.current = false
    } else if (e.touches.length === 1 && !touchOnMagnet.current) {
      pinchStart.current = null
      isPanning.current = true
      const t = e.touches[0]
      panStart.current = { mx: t.clientX, my: t.clientY, tx: transform.current.tx, ty: transform.current.ty }
    }
  }

  const mapSrc = (m: Magnet) => {
    if (m.lat && m.lng) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${m.lng - 0.1},${m.lat - 0.08},${m.lng + 0.1},${m.lat + 0.08}&layer=mapnik&marker=${m.lat},${m.lng}`
    }
    return `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(m.location)}&layer=mapnik`
  }

  return (
    <div ref={viewportRef} onWheel={onWheel} onMouseDown={onMouseDown}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{
        position: 'absolute', inset: 0,
        background: '#f5f0eb',
        backgroundImage: `radial-gradient(circle at 1px 1px, #e8e0d4 1px, transparent 0)`,
        backgroundSize: '24px 24px',
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
      }}
    >
      <div ref={canvasRef} style={{
        position: 'absolute', left: 0, top: 0,
        width: FRIDGE_W, height: FRIDGE_H,
        transformOrigin: '0 0',
        backgroundImage: `url(${fridgeImage})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      }}>
        {magnets.length === 0 && (
          <div style={{
            position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
            color: 'rgba(120,100,80,0.35)', fontSize: 18, textAlign: 'center', pointerEvents: 'none',
          }}>
            贴上你的第一枚冰箱贴吧 🧲
          </div>
        )}
        {magnets.map(m => (
          <MagnetSticker key={m.id} magnet={m}
            getZoom={() => transform.current.zoom}
            onUpdate={(posX, posY, scale) => onUpdate(m.id, posX, posY, scale)}
            onDelete={() => onDelete(m.id)}
            onHover={onHover}
          />
        ))}
      </div>

      {/* Hover info panel */}
      {hoveredMagnet && (
        <div
          onMouseLeave={() => onHover(null)}
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            width: 300, background: 'rgba(255,252,248,0.96)', backdropFilter: 'blur(16px)',
            borderRadius: 18, overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.16)', border: '1px solid #e8e0d4',
            zIndex: 50, animation: 'slideIn 0.2s ease',
          }}
        >
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f0ebe4' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3a2f28' }}>📍 {hoveredMagnet.location}</div>
            {hoveredMagnet.created_at && (
              <div style={{ fontSize: 11, color: '#b0a090', marginTop: 3 }}>
                {new Date(hoveredMagnet.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            )}
          </div>
          <div style={{ height: 160, background: '#e8e4df' }}>
            <iframe src={mapSrc(hoveredMagnet)} style={{ width: '100%', height: '100%', border: 'none' }} title="map" />
          </div>
          {hoveredMagnet.note && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0ebe4' }}>
              <div style={{ fontSize: 11, color: '#b0a090', marginBottom: 4, fontWeight: 600 }}>✍️ 旅行小记</div>
              <div style={{ fontSize: 13, color: '#5a4f45', lineHeight: 1.7 }}>{hoveredMagnet.note}</div>
            </div>
          )}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 8, borderTop: '1px solid #f0ebe4' }}>
            {hoveredMagnet.lat && hoveredMagnet.lng && (
              <>
                <a href={`https://www.amap.com/search?query=${encodeURIComponent(hoveredMagnet.location)}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', padding: '7px 0', background: '#06c', color: '#fff', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                  高德地图 ↗
                </a>
                <a href={`https://maps.google.com/?q=${hoveredMagnet.lat},${hoveredMagnet.lng}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', padding: '7px 0', background: '#e94560', color: '#fff', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                  Google Maps ↗
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single Magnet Sticker ────────────────────────────────────────────────────
const DOOR_X0 = 10
const DOOR_X1 = FRIDGE_W - 10
const DOOR_Y0 = 10
const DOOR_Y1 = FRIDGE_H - 10

function MagnetSticker({ magnet, getZoom, onUpdate, onDelete, onHover }: {
  magnet: Magnet
  getZoom: () => number
  onUpdate: (posX: number, posY: number, scale: number) => void
  onDelete: () => void
  onHover: (m: Magnet | null) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const offset = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)
  const cur = useRef({ posX: magnet.pos_x, posY: magnet.pos_y, scale: magnet.scale || 1 })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => { cur.current = { posX: magnet.pos_x, posY: magnet.pos_y, scale: magnet.scale || 1 } }, [magnet])

  const size = () => MAGNET_BASE * (cur.current.scale || 1)

  const getCanvasPos = (clientX: number, clientY: number) => {
    const elem = el.current
    if (!elem) return null
    const canvas = elem.parentElement
    if (!canvas) return null
    const cr = canvas.getBoundingClientRect()
    const z = getZoom()
    return { x: (clientX - cr.left) / z, y: (clientY - cr.top) / z }
  }

  const clamp = (canvasX: number, canvasY: number) => {
    const s = size()
    const left = Math.max(DOOR_X0, Math.min(DOOR_X1 - s, canvasX - offset.current.x))
    const top = Math.max(DOOR_Y0, Math.min(DOOR_Y1 - s, canvasY - offset.current.y))
    if (el.current) { el.current.style.left = left + 'px'; el.current.style.top = top + 'px' }
    return { left, top }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const elem = el.current
    if (!elem) return
    hasMoved.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    elem.style.zIndex = '200'
    const z = getZoom()
    const er = elem.getBoundingClientRect()
    offset.current = { x: (e.clientX - er.left) / z, y: (e.clientY - er.top) / z }

    const onMM = (e: MouseEvent) => {
      const dx = e.clientX - startPos.current.x
      const dy = e.clientY - startPos.current.y
      if (!hasMoved.current && Math.hypot(dx, dy) > 8) hasMoved.current = true
      if (!hasMoved.current) return
      const p = getCanvasPos(e.clientX, e.clientY)
      if (!p) return
      clamp(p.x, p.y)
    }
    const onMU = (e: MouseEvent) => {
      if (elem) elem.style.zIndex = '10'
      const p = getCanvasPos(e.clientX, e.clientY)
      if (p && hasMoved.current) {
        const { left, top } = clamp(p.x, p.y)
        const newPosX = left / FRIDGE_W
        const newPosY = top / FRIDGE_H
        cur.current = { ...cur.current, posX: newPosX, posY: newPosY }
        onUpdate(newPosX, newPosY, cur.current.scale)
      }
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
    }
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
  }

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const elem = el.current
    if (!elem) return
    const startX = e.clientX
    const startY = e.clientY
    const startScale = cur.current.scale || 1
    const z = getZoom()

    const onMM = (e: MouseEvent) => {
      const dx = (e.clientX - startX) / z
      const dy = (e.clientY - startY) / z
      const delta = (dx + dy) / 2
      const newScale = Math.max(0.3, Math.min(3.0, startScale + delta / 100))
      cur.current = { ...cur.current, scale: newScale }
      const sz = MAGNET_BASE * newScale
      elem.style.width = sz + 'px'
      elem.style.height = sz + 'px'
    }
    const onMU = () => {
      onUpdate(cur.current.posX, cur.current.posY, cur.current.scale)
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
    }
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    const t = e.touches[0]
    const elem = el.current
    if (!elem) return
    const z = getZoom()
    const er = elem.getBoundingClientRect()
    offset.current = { x: (t.clientX - er.left) / z, y: (t.clientY - er.top) / z }
    startPos.current = { x: t.clientX, y: t.clientY }
    hasMoved.current = false
    elem.style.zIndex = '200'
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      if (confirm('移除这枚冰箱贴？')) onDelete()
    }, 600)

    const onTM = (e: TouchEvent) => {
      const t = e.touches[0]
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
      const dx = t.clientX - startPos.current.x
      const dy = t.clientY - startPos.current.y
      if (Math.hypot(dx, dy) > 8) hasMoved.current = true
      if (!hasMoved.current) return
      const p = getCanvasPos(t.clientX, t.clientY)
      if (!p) return
      clamp(p.x, p.y)
    }
    const onTE = (e: TouchEvent) => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
      if (elem) elem.style.zIndex = '10'
      if (hasMoved.current) {
        const t = e.changedTouches[0]
        const p = getCanvasPos(t.clientX, t.clientY)
        if (p) {
          const { left, top } = clamp(p.x, p.y)
          cur.current = { ...cur.current, posX: left / FRIDGE_W, posY: top / FRIDGE_H }
          onUpdate(left / FRIDGE_W, top / FRIDGE_H, cur.current.scale)
        }
      }
      hasMoved.current = false
      elem.removeEventListener('touchmove', onTM)
      elem.removeEventListener('touchend', onTE)
    }
    elem.addEventListener('touchmove', onTM, { passive: true })
    elem.addEventListener('touchend', onTE)
  }

  const left = magnet.pos_x * FRIDGE_W
  const top = magnet.pos_y * FRIDGE_H
  const sz = MAGNET_BASE * (magnet.scale || 1)

  return (
    <div ref={el} data-magnet-id={magnet.id}
      style={{
        position: 'absolute', left, top, width: sz, height: sz,
        zIndex: 10, touchAction: 'none',
        pointerEvents: hovered ? 'auto' : 'none',
        filter: hovered
          ? 'drop-shadow(2px 6px 12px rgba(0,0,0,0.35)) drop-shadow(0px 2px 4px rgba(0,0,0,0.2))'
          : 'drop-shadow(1px 2px 3px rgba(0,0,0,0.22)) drop-shadow(0px 1px 1px rgba(0,0,0,0.12))',
        transform: hovered ? 'scale(1.12)' : 'scale(1)',
        transition: 'transform 0.18s ease, filter 0.18s ease',
        transformOrigin: 'center center',
      }}
    >
      {magnet.image_url
        ? <img
            src={magnet.image_url} draggable={false}
            onMouseEnter={() => { setHovered(true); onHover(magnet) }}
            onMouseLeave={() => { setHovered(false); onHover(null) }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'auto', cursor: 'grab' }}
          />
        : <div
            onMouseEnter={() => { setHovered(true); onHover(magnet) }}
            onMouseLeave={() => { setHovered(false); onHover(null) }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, pointerEvents: 'auto', cursor: 'grab' }}
          >🧲</div>
      }
      {hovered && (
        <div
          data-resize-handle="true"
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute', right: -6, bottom: -6,
            width: 14, height: 14, borderRadius: '50%',
            background: '#e94560', border: '2px solid #fff',
            cursor: 'nwse-resize', zIndex: 300,
            pointerEvents: 'auto',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        />
      )}
    </div>
  )
}
