'use client'

import { Clock3, Tags, Users, Wrench } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { PortalBackground } from '@/components/portal-background'

const COPY = {
  title: '社区',
  subtitle: '社区内容占位',
  workbench: '网页管理',
  variables: '变量管理',
  config: '配置中心',
  cards: [
    { title: '提示词广场', description: '待接入社区提示词与模板。', icon: Tags },
    { title: '工具分享', description: '待接入 Agent 工具与使用样例。', icon: Wrench },
    { title: '最近更新', description: '待接入社区动态与精选内容。', icon: Clock3 },
  ],
}

export function CommunityPage() {
  return (
    <div className="relative flex min-h-screen min-w-[1080px] flex-col overflow-hidden bg-transparent text-slate-900">
      <PortalBackground />
      <AppHeader
        activeItem="community"
        labels={{ workbench: COPY.workbench, variables: COPY.variables, community: COPY.title, config: COPY.config }}
      />

      <main className="relative z-10 min-h-0 flex-1 overflow-auto p-4">
        <section className="mx-auto flex max-w-[1180px] flex-col gap-3">
          <div className="flex min-h-[180px] items-center justify-between gap-5 rounded-md border border-slate-200 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="min-w-0">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#fff2ea] text-[#d95a1b]">
                <Users className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-black text-slate-950">{COPY.title}</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">{COPY.subtitle}</p>
            </div>
            <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-[#f2b28d] bg-[#fff7f2] text-[#d95a1b] md:flex">
              <Users className="h-9 w-9" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {COPY.cards.map((card) => {
              const Icon = card.icon
              return (
                <article key={card.title} className="rounded-md border border-slate-200 bg-white/95 p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-black text-slate-950">{card.title}</h2>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{card.description}</p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
