import type { Metadata } from 'next'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'ccks - 编辑器工作台',
  description: 'ccks，新时代 AI 代码编辑工具以及编辑框架。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
