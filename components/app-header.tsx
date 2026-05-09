'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { LayoutDashboard, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppHeaderNavKey = 'workbench' | 'variables' | 'community' | 'config'

export type AppHeaderLabels = Record<AppHeaderNavKey, string>

const DEFAULT_LABELS: AppHeaderLabels = {
  workbench: '网页管理',
  variables: '变量管理',
  community: '社区',
  config: '配置中心',
}

const NAV_ITEMS: Array<{
  key: AppHeaderNavKey
  href: string
  icon: typeof LayoutDashboard
}> = [
  { key: 'workbench', href: '/', icon: LayoutDashboard },
  { key: 'community', href: '/community', icon: Users },
]

export function AppHeader({
  activeItem,
  labels = DEFAULT_LABELS,
  rightContent,
  onWorkbenchClick,
}: {
  activeItem: AppHeaderNavKey
  labels?: AppHeaderLabels
  rightContent?: ReactNode
  onWorkbenchClick?: () => void
}) {
  const router = useRouter()

  function handleNavClick(key: AppHeaderNavKey, href: string) {
    if (key === 'workbench' && onWorkbenchClick) {
      onWorkbenchClick()
      return
    }
    router.push(href)
  }

  return (
    <header className="relative z-10 flex h-12 shrink-0 items-center border-b border-slate-200/80 bg-white shadow-[0_1px_20px_rgba(15,23,42,0.04)]">
      <div className="flex h-full w-14 shrink-0 items-center justify-center">
        <div className="grid h-7 w-7 place-items-center">
          <Image src="/zr-logo.png" alt="从词开始" width={24} height={24} />
        </div>
      </div>
      <nav className="flex h-full min-w-0 flex-1 items-center overflow-x-auto" aria-label="主导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeItem === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavClick(item.key, item.href)}
              className={cn(
                'flex h-full shrink-0 items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition',
                active
                  ? 'border-[#FB7E3D] bg-[#fff2ea] text-[#d95a1b]'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
              aria-current={active ? 'page' : undefined}
              title={labels[item.key]}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{labels[item.key]}</span>
            </button>
          )
        })}
      </nav>
      {rightContent ? <div className="flex shrink-0 items-center gap-2 px-4">{rightContent}</div> : null}
    </header>
  )
}
