import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '在线冰箱 | Cyber Fridge Magnet',
  description: '你的旅行记忆，贴在冰箱上',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
