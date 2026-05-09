import type { Metadata } from 'next'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: '从词开始 - 编辑器工作台',
  description: '从词开始提示词文件化编辑与管理工作台。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
