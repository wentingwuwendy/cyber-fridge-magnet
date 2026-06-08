'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '../utils/supabase/client'
import FridgeCanvas from '../components/FridgeCanvas'
import UploadPanel from '../components/UploadPanel'
import { User } from '@supabase/supabase-js'

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

interface Fridge {
  id: number
  name: string
  image_url: string | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [fridges, setFridges] = useState<Fridge[]>([])
  const [currentFridgeId, setCurrentFridgeId] = useState<number | null>(null)
  const [magnets, setMagnets] = useState<Magnet[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [showFridgeMenu, setShowFridgeMenu] = useState(false)
  const [showFridgeModal, setShowFridgeModal] = useState(false)
  const [hoveredMagnet, setHoveredMagnet] = useState<Magnet | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const currentFridgeIdRef = useRef<number | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Load user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  // Load fridges
  const loadFridges = useCallback(async () => {
    try {
      const res = await fetch('/api/fridges')
      const data = await res.json()
      if (data.fridges) {
        setFridges(data.fridges)
        if (data.fridges.length > 0) {
          const first = data.fridges[0]
          setCurrentFridgeId(first.id)
          currentFridgeIdRef.current = first.id
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Load magnets
  const loadMagnets = useCallback(async (fridgeId?: number) => {
    const fid = fridgeId ?? currentFridgeIdRef.current
    if (!fid) return
    try {
      const res = await fetch(`/api/magnets?fridge_id=${fid}`)
      const data = await res.json()
      if (data.magnets) {
        setMagnets(data.magnets)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { loadFridges() }, [loadFridges])

  useEffect(() => {
    if (currentFridgeId) {
      loadMagnets(currentFridgeId)
    }
  }, [currentFridgeId, loadMagnets])

  const switchFridge = (id: number) => {
    setCurrentFridgeId(id)
    currentFridgeIdRef.current = id
    setShowFridgeMenu(false)
    setMagnets([])
  }

  const deleteFridge = async (id: number, name: string) => {
    if (!confirm(`确定删除「${name}」？该冰箱上的所有贴纸也会一并删除。`)) return
    try {
      const res = await fetch(`/api/fridges/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      const newFridges = fridges.filter(f => f.id !== id)
      setFridges(newFridges)
      if (currentFridgeId === id) {
        if (newFridges.length > 0) {
          switchFridge(newFridges[0].id)
        } else {
          await loadFridges()
        }
      }
      showToast('冰箱已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', 'err')
    }
  }

  const handleMagnetUpdate = async (id: number, posX: number, posY: number, scale: number) => {
    setMagnets(ms => ms.map(m => m.id === id ? { ...m, posX, posY, scale } : m))
    try {
      await fetch(`/api/magnets/${id}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posX, posY, scale }),
      })
    } catch {
      // ignore
    }
  }

  const handleMagnetDelete = async (id: number) => {
    try {
      await fetch(`/api/magnets/${id}`, { method: 'DELETE' })
      setMagnets(ms => ms.filter(m => m.id !== id))
      if (hoveredMagnet?.id === id) setHoveredMagnet(null)
      showToast('已移除')
    } catch {
      showToast('删除失败', 'err')
    }
  }

  const handleFridgeCreated = async (fridge: Fridge) => {
    setFridges(f => [...f, fridge])
    switchFridge(fridge.id)
    showToast('🧊 新冰箱已创建！')
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const handleUploadComplete = async () => {
    setPanelOpen(false)
    await loadMagnets()
    showToast('🧲 已贴上冰箱！')
  }

  const currentFridge = fridges.find(f => f.id === currentFridgeId)

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f5f0eb' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'ok' ? '#27ae60' : '#e74c3c',
          color: '#fff', padding: '10px 22px', borderRadius: 20, fontSize: 14,
          zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{
        background: 'rgba(255,252,248,0.92)', backdropFilter: 'blur(12px)',
        padding: '10px 18px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #e8e0d4', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() => setShowFridgeMenu(v => !v)}
          >
            <span style={{ fontSize: 20 }}>🧊</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#4a3f35' }}>
              {currentFridge?.name || '我的在线冰箱'}
            </span>
            <span style={{ fontSize: 11, color: '#b0a090', marginLeft: 2 }}>▾</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowFridgeMenu(false); setShowFridgeModal(true) }}
            title="新建冰箱"
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: '#e94560', color: '#fff',
              border: 'none', fontSize: 16, lineHeight: '24px', textAlign: 'center',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(233,69,96,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >＋</button>
        </div>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#b0a090' }}>{user.email}</span>
            <button onClick={handleSignOut}
              style={{
                background: 'none', border: '1px solid #e0d8d0', borderRadius: 8,
                padding: '4px 12px', fontSize: 12, color: '#a09080', cursor: 'pointer',
              }}>
              退出
            </button>
          </div>
        )}

        {/* Fridge menu dropdown */}
        {showFridgeMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowFridgeMenu(false)} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 8,
              width: 200, background: 'rgba(255,252,248,0.98)', backdropFilter: 'blur(16px)',
              borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)', border: '1px solid #e8e0d4', zIndex: 100,
            }}>
              <div style={{ padding: '6px 0' }}>
                {fridges.map(f => (
                  <div key={f.id}
                    style={{
                      padding: '9px 12px 9px 16px', fontSize: 14, cursor: 'pointer',
                      background: f.id === currentFridgeId ? '#f0ebe4' : 'transparent',
                      fontWeight: f.id === currentFridgeId ? 700 : 400,
                      color: '#4a3f35', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => { if (f.id !== currentFridgeId) e.currentTarget.style.background = '#faf7f4' }}
                    onMouseLeave={e => { e.currentTarget.style.background = f.id === currentFridgeId ? '#f0ebe4' : 'transparent' }}
                  >
                    <div onClick={() => switchFridge(f.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      {f.id === currentFridgeId
                        ? <span style={{ color: '#27ae60', fontSize: 13, flexShrink: 0 }}>✓</span>
                        : <span style={{ width: 13, flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteFridge(f.id, f.name) }}
                      title="删除冰箱"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#c0b0a0', fontSize: 14, padding: '2px 4px', borderRadius: 4,
                        flexShrink: 0, lineHeight: 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e94560')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#c0b0a0')}
                    >🗑</button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #ede8e0', padding: '4px 0' }}>
                <div
                  onClick={() => { setShowFridgeMenu(false); setShowFridgeModal(true) }}
                  style={{
                    padding: '9px 16px', fontSize: 14, cursor: 'pointer',
                    color: '#e94560', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fdf0f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >＋ 新建冰箱</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fridge New Modal */}
      {showFridgeModal && (
        <FridgeNewModal
          onClose={() => setShowFridgeModal(false)}
          onCreated={handleFridgeCreated}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {currentFridgeId && (
          <FridgeCanvas
            magnets={magnets}
            fridgeImage={currentFridge?.image_url || '/fridge.png'}
            onUpdate={handleMagnetUpdate}
            onDelete={handleMagnetDelete}
            onHover={setHoveredMagnet}
            hoveredMagnet={hoveredMagnet}
          />
        )}

        {/* + button */}
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            position: 'absolute', bottom: 28, right: 24,
            width: 56, height: 56, borderRadius: '50%',
            background: '#e94560', color: '#fff',
            border: 'none', fontSize: 28, fontWeight: 300,
            boxShadow: '0 4px 20px rgba(233,69,96,0.45)',
            cursor: 'pointer', zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >＋</button>

        {magnets.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 36, left: 20,
            background: 'rgba(255,252,248,0.85)', backdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '4px 12px', fontSize: 13, color: '#a09080',
            border: '1px solid #e8e0d4', pointerEvents: 'none',
          }}>🧲 {magnets.length} 枚</div>
        )}

        {/* Upload panel */}
        {panelOpen && currentFridgeId && (
          <UploadPanel
            fridgeId={currentFridgeId}
            onClose={() => setPanelOpen(false)}
            onUploadComplete={handleUploadComplete}
            onError={(msg) => showToast(msg, 'err')}
          />
        )}
      </div>
    </div>
  )
}

// ── Fridge New Modal ─────────────────────────────────────────────────────────
const FRIDGE_STYLE_OPTIONS = [
  { key: 'retro-american', label: '🇺🇸 复古美式', desc: '奶油白烤漆·镀铬把手' },
  { key: 'nordic', label: '🌿 北欧极简', desc: '哑光灰绿·木纹把手' },
  { key: 'japanese', label: '🌸 日式小型', desc: '粉白圆润·银色把手' },
  { key: 'industrial', label: '🔩 工业黑钢', desc: '磨砂不锈钢·金属拉手' },
  { key: 'french', label: '🥐 法式复古', desc: '薄荷绿·黄铜把手' },
  { key: 'smart', label: '🤖 现代智能', desc: '深空灰·内嵌屏幕' },
]

interface FridgeNewModalProps {
  onClose: () => void
  onCreated: (fridge: { id: number; name: string; image_url: string | null }) => void
  onError: (msg: string) => void
}

function FridgeNewModal({ onClose, onCreated, onError }: FridgeNewModalProps) {
  const [name, setName] = useState('')
  const [style, setStyle] = useState('')
  const [customStyle, setCustomStyle] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (generating) return
    setGenerating(true)
    setPreview(null)
    try {
      const res = await fetch('/api/generate-fridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, customStyle }),
      })
      if (!res.ok) throw new Error('生成失败')
      const data = await res.json()
      setPreview(`data:image/png;base64,${data.image}`)
    } catch (e: any) {
      onError(e.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleConfirm = async () => {
    try {
      const imageB64 = preview?.replace(/^data:image\/png;base64,/, '')
      const res = await fetch('/api/fridges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || '新冰箱', image_b64: imageB64 }),
      })
      if (!res.ok) throw new Error('创建失败')
      const fridge = await res.json()
      onCreated(fridge)
    } catch (e: any) {
      onError(e.message || '创建失败')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget && !generating) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 24, width: '100%', maxWidth: 360,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '90vh',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0ebe4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#2d2520' }}>🧊 新建冰箱</div>
            <div style={{ fontSize: 12, color: '#a09080', marginTop: 2 }}>AI 将为你生成一台独特风格的冰箱</div>
          </div>
          <button onClick={() => { if (!generating) onClose() }}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#b0a090', padding: 4 }}>×</button>
        </div>

        <div style={{ padding: '16px 24px 8px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#a09080', display: 'block', marginBottom: 6 }}>冰箱名称</label>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !generating && !preview) handleGenerate() }}
            placeholder="例：旅行冰箱、美食冰箱…（可选）" maxLength={20} autoFocus
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1.5px solid #e0d8d0', fontSize: 14, outline: 'none',
              background: '#faf7f4', color: '#2d2520', boxSizing: 'border-box',
              fontFamily: 'inherit',
            }} />
        </div>

        <div style={{ padding: '4px 24px 12px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#a09080', display: 'block', marginBottom: 8 }}>冰箱风格</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {FRIDGE_STYLE_OPTIONS.map(opt => (
              <div key={opt.key} onClick={() => setStyle(opt.key)}
                style={{
                  padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${style === opt.key ? '#e94560' : '#e0d8d0'}`,
                  background: style === opt.key ? '#fff0f3' : '#faf7f4',
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: style === opt.key ? '#e94560' : '#4a3f35' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#a09080', marginTop: 2 }}>{opt.desc}</div>
              </div>
            ))}
            <div onClick={() => setStyle('custom')}
              style={{
                padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${style === 'custom' ? '#e94560' : '#e0d8d0'}`,
                background: style === 'custom' ? '#fff0f3' : '#faf7f4',
                gridColumn: '1 / -1',
              }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: style === 'custom' ? '#e94560' : '#4a3f35' }}>✏️ 自定义风格</div>
              <div style={{ fontSize: 11, color: '#a09080', marginTop: 2 }}>描述你想要的冰箱样子</div>
            </div>
          </div>
          {style === 'custom' && (
            <textarea placeholder="例：粉色少女心冰箱，圆润可爱…" maxLength={100} rows={2}
              value={customStyle} onChange={e => setCustomStyle(e.target.value)}
              style={{
                width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 10,
                border: '1.5px solid #e0d8d0', fontSize: 13, outline: 'none',
                background: '#faf7f4', color: '#2d2520', boxSizing: 'border-box',
                fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
              }} />
          )}
        </div>

        <div style={{ margin: '0 24px 8px', borderRadius: 16, background: '#f5f0eb', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {!preview && !generating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#c0b0a0', padding: 24, textAlign: 'center' }}>
              <span style={{ fontSize: 36 }}>🧊</span>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>选择风格后点击<br/>「✨ 生成冰箱」预览效果</div>
            </div>
          )}
          {generating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#a09080', padding: 24 }}>
              <div style={{ fontSize: 28, animation: 'spin 1.2s linear infinite' }}>✨</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>AI 正在生成你的冰箱…</div>
              <div style={{ fontSize: 12, color: '#c0b0a0' }}>约需 15–30 秒，请稍候</div>
            </div>
          )}
          {preview && !generating && (
            <img src={preview} style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 12, padding: 8 }} />
          )}
        </div>

        <div style={{ padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!preview && !generating && (
            <button onClick={handleGenerate}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: '#e94560', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>
              ✨ 生成冰箱预览
            </button>
          )}
          {preview && !generating && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleGenerate}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #e0d8d0', background: '#faf7f4', color: '#4a3f35', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                🔄 换一个
              </button>
              <button onClick={handleConfirm}
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: '#e94560', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                使用这个 ✅
              </button>
            </div>
          )}
          <button onClick={onClose} disabled={generating}
            style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid #e0d8d0', background: 'transparent', color: '#a09080', fontSize: 14, cursor: generating ? 'not-allowed' : 'pointer' }}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
