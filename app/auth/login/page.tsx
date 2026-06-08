'use client'

import { Suspense } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    const supabase = createClient()
    const redirectUrl = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f5f0eb', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          background: '#fff', borderRadius: 24, padding: '48px 36px', textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)', maxWidth: 400, width: '90%',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#2d2520', marginBottom: 8 }}>请检查邮箱</h2>
          <p style={{ fontSize: 14, color: '#a09080', lineHeight: 1.6 }}>
            我们已向 <strong>{email}</strong> 发送了一封登录邮件。<br/>
            点击邮件中的链接即可登录。
          </p>
          <button
            onClick={() => setSent(false)}
            style={{
              marginTop: 24, padding: '10px 24px', borderRadius: 10,
              border: '1.5px solid #e0d8d0', background: 'transparent',
              color: '#a09080', fontSize: 13, cursor: 'pointer',
            }}
          >
            返回重新输入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f0eb', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '48px 36px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)', maxWidth: 400, width: '90%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🧊</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2d2520', margin: 0 }}>在线冰箱</h1>
          <p style={{ fontSize: 13, color: '#a09080', marginTop: 4 }}>你的旅行记忆，贴在冰箱上</p>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#a09080', display: 'block', marginBottom: 6 }}>
            邮箱地址
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #e0d8d0', fontSize: 15, outline: 'none',
              background: '#faf7f4', color: '#2d2520', boxSizing: 'border-box',
              fontFamily: 'inherit', marginBottom: error ? 8 : 16,
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 12 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: loading || !email.trim() ? '#e8e0d8' : '#e94560',
              color: loading || !email.trim() ? '#b0a090' : '#fff',
              border: 'none', fontSize: 15, fontWeight: 700,
              cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: 0.5,
            }}
          >
            {loading ? '发送中…' : '发送登录链接 →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0eb' }}>
      <div style={{ color: '#a09080', fontSize: 14 }}>加载中…</div>
    </div>}>
      <LoginPageContent />
    </Suspense>
  )
}
