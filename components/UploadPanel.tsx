'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

interface UploadPanelProps {
  fridgeId: number
  onClose: () => void
  onUploadComplete: () => void
  onError: (msg: string) => void
}

export default function UploadPanel({ fridgeId, onClose, onUploadComplete, onError }: UploadPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<GeoResult | null>(null)
  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedBadge, setGeneratedBadge] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetPanel = useCallback(() => {
    setSelectedFile(null)
    setPreview(null)
    setSearchQuery('')
    setSearchResults([])
    setSelectedPlace(null)
    setNote('')
    setGeneratedBadge(null)
    setGenerating(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setSelectedFile(f)
    setPreview(URL.createObjectURL(f))
    // Reset generated badge when new file is selected
    setGeneratedBadge(null)
  }

  // Nominatim search with debounce
  const searchPlace = (q: string) => {
    setSearchQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=zh-CN`
        const r = await fetch(url, { headers: { 'Accept-Language': 'zh-CN,zh' } })
        const data: GeoResult[] = await r.json()
        setSearchResults(data)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 600)
  }

  const selectPlace = (p: GeoResult) => {
    setSelectedPlace(p)
    setSearchQuery(p.display_name.split(',')[0])
    setSearchResults([])
  }

  // AI Generate Badge
  const handleGenerate = async () => {
    if (!selectedFile || !selectedPlace) return
    setGenerating(true)
    setGeneratedBadge(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('location', searchQuery.trim())
      const res = await fetch('/api/generate-badge', { method: 'POST', body: fd })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || e.detail || '生成失败')
      }
      const { badge } = await res.json()
      setGeneratedBadge(`data:image/png;base64,${badge}`)
    } catch (e: any) {
      onError(e.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // Upload to fridge
  const handleUpload = async () => {
    if (!selectedPlace) {
      onError('请先选择旅行地')
      return
    }

    let fileToUpload: File
    if (generatedBadge) {
      // Convert base64 to File
      const res = await fetch(generatedBadge)
      const blob = await res.blob()
      fileToUpload = new File([blob], 'badge.png', { type: 'image/png' })
    } else if (selectedFile) {
      fileToUpload = selectedFile
    } else {
      onError('请先生成冰箱贴')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', fileToUpload)
      fd.append('location', searchQuery.trim())
      fd.append('note', note.trim())
      fd.append('lat', selectedPlace.lat)
      fd.append('lng', selectedPlace.lon)
      fd.append('fridge_id', String(fridgeId))

      const res = await fetch('/api/magnets', { method: 'POST', body: fd })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || e.detail || '上传失败')
      }

      onUploadComplete()
      resetPanel()
    } catch (e: any) {
      onError(e.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div onClick={() => { onClose(); resetPanel() }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 30, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(400px, 100vw)',
        background: 'rgba(255,252,248,0.99)', backdropFilter: 'blur(20px)',
        padding: '24px 24px 40px',
        zIndex: 40, boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#4a3f35' }}>添加冰箱贴</span>
          <button onClick={() => { onClose(); resetPanel() }}
            style={{ background: 'none', border: 'none', fontSize: 20, color: '#b0a090', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Step 1: Upload photo */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a09080', marginBottom: 8 }}>① 上传照片</div>
        <div onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${preview ? '#e94560' : '#ddd0c8'}`,
            borderRadius: 14, minHeight: 130,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginBottom: 16, overflow: 'hidden', background: '#faf7f4',
          }}>
          {preview
            ? <img src={preview} style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', padding: 8 }} />
            : <div style={{ textAlign: 'center', color: '#c0b0a0' }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
                <div style={{ fontSize: 13 }}>点击上传旅行照片</div>
                <div style={{ fontSize: 11, marginTop: 3, color: '#d0c0b0' }}>AI 将生成冰箱贴图标</div>
              </div>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />

        {/* Generated badge preview */}
        {generatedBadge && (
          <div style={{
            borderRadius: 14, padding: 16, marginBottom: 16,
            background: '#f0ede8', display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#a09080', marginBottom: 8, fontWeight: 600 }}>✨ AI 生成的冰箱贴</div>
            <img src={generatedBadge} style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', marginBottom: 8 }} />
            <button onClick={handleGenerate} disabled={generating}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd0c8',
                background: '#fff', color: '#4a3f35', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              🔄 重新生成
            </button>
          </div>
        )}

        {/* Step 2: Search location */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a09080', marginBottom: 8 }}>② 选择旅行地（必选）</div>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <input
            type="text" placeholder="搜索城市或景点，例：布达拉宫"
            value={searchQuery} onChange={e => searchPlace(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10,
              border: `1.5px solid ${selectedPlace ? '#27ae60' : '#ddd0c8'}`,
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
              background: '#faf7f4', color: '#4a3f35',
            }}
          />
          {selectedPlace && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>✅</span>
          )}
        </div>

        {/* Search results */}
        {(searching || searchResults.length > 0) && (
          <div style={{
            background: '#fff', borderRadius: 10, border: '1px solid #e8e0d4',
            overflow: 'hidden', marginBottom: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}>
            {searching && <div style={{ padding: '10px 14px', fontSize: 13, color: '#b0a090' }}>搜索中…</div>}
            {searchResults.map((r, i) => (
              <div key={i} onClick={() => selectPlace(r)}
                style={{
                  padding: '10px 14px', fontSize: 13, color: '#4a3f35',
                  cursor: 'pointer', borderTop: i > 0 ? '1px solid #f0ebe4' : 'none',
                  lineHeight: 1.4,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#faf7f4')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                📍 {r.display_name.split(',').slice(0, 2).join(',')}
              </div>
            ))}
            {!searching && searchResults.length === 0 && searchQuery && (
              <div style={{ padding: '10px 14px', fontSize: 13, color: '#b0a090' }}>未找到结果，换个关键词试试</div>
            )}
          </div>
        )}

        {/* Step 3: Travel notes (optional) */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a09080', marginBottom: 8 }}>③ 旅行小记（可选）</div>
        <textarea
          placeholder="记下这次旅行的故事、感受…"
          value={note} onChange={e => setNote(e.target.value)}
          rows={3}
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1px solid #ddd0c8', fontSize: 13, outline: 'none',
            boxSizing: 'border-box', marginBottom: 16, resize: 'none',
            background: '#faf7f4', color: '#4a3f35', lineHeight: 1.6,
            fontFamily: 'inherit',
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Generate badge button */}
          {selectedFile && selectedPlace && !generatedBadge && (
            <button onClick={handleGenerate} disabled={generating}
              style={{
                width: '100%', padding: 14, borderRadius: 12,
                background: generating ? '#f0ebe4' : '#8b5cf6',
                color: generating ? '#b0a090' : '#fff',
                border: 'none', fontSize: 15, fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {generating ? '⏳ AI 生成中，约需 15-30 秒…' : '✨ AI 生成冰箱贴'}
            </button>
          )}
          {/* Pin to fridge button */}
          <button
            onClick={handleUpload}
            disabled={(!generatedBadge && !selectedFile) || !selectedPlace || uploading}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: (generatedBadge || selectedFile) && selectedPlace && !uploading ? '#e94560' : '#e8e0d8',
              color: (generatedBadge || selectedFile) && selectedPlace && !uploading ? '#fff' : '#b0a090',
              border: 'none', fontSize: 16, fontWeight: 600,
              cursor: (generatedBadge || selectedFile) && selectedPlace && !uploading ? 'pointer' : 'not-allowed',
              WebkitTapHighlightColor: 'transparent',
            }}
          >{uploading ? '上传中…' : '🧲 贴上冰箱'}</button>
        </div>
      </div>
    </>
  )
}
