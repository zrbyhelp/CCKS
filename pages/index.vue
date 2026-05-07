<script setup lang="ts">
useHead({
  title: '从词开始 - 网站建设中',
  meta: [
    {
      name: 'description',
      content: '从词开始是一个提示词管理工具，当前网站建设中。',
    },
  ],
})

const highlights = [
  {
    icon: '</>',
    title: '多类型提示词',
    description: '支持图片、文本、Agent 等多种提示词统一管理',
    tone: 'violet' as const,
  },
  {
    icon: '{}',
    title: '变量与词汇库',
    description: '支持变量占位、词汇库管理，复用更灵活',
    tone: 'orange' as const,
  },
  {
    icon: 'DIR',
    title: '文件化管理',
    description: '提示词文件化，支持文件结构、下载导出',
    tone: 'blue' as const,
  },
  {
    icon: 'BOT',
    title: '智能体工作流',
    description: '可视化设计智能体工作流程，构建复杂任务',
    tone: 'green' as const,
  },
  {
    icon: 'CTX',
    title: '上下文管理',
    description: '多轮上下文管理，关联历史记录，提升生成质量',
    tone: 'blue' as const,
  },
  {
    icon: 'SET',
    title: '工具管理',
    description: '管理常用工具与组件，自定义工具集',
    tone: 'violet' as const,
  },
  {
    icon: 'V1',
    title: '版本迭代',
    description: '版本记录与回溯，轻松对比变更',
    tone: 'pink' as const,
  },
  {
    icon: 'DL',
    title: '文件下载',
    description: '支持多种格式导出，一键下载便于备份分享',
    tone: 'cyan' as const,
  },
  {
    icon: 'Aa',
    title: '词汇变量',
    description: '自定义词汇变量，批量替换，高效创作',
    tone: 'yellow' as const,
  },
  {
    icon: 'LIB',
    title: '词汇库管理',
    description: '集中管理词汇库，分类清晰，便于复用',
    tone: 'violet' as const,
  },
  {
    icon: 'USR',
    title: '社区与分享',
    description: '加入社区，分享优质提示词，与创作者共同成长',
    tone: 'blue' as const,
  },
  {
    icon: '♥',
    title: '点赞与收藏',
    description: '喜欢的内容一键收藏，点赞互动，发现更多灵感',
    tone: 'pink' as const,
  },
  {
    icon: 'KEY',
    title: '协作与权限',
    description: '团队协作、权限分级管理，安全共享',
    tone: 'green' as const,
  },
  {
    icon: 'DAT',
    title: '数据统计',
    description: '生成数据统计分析，洞察使用情况，优化创作',
    tone: 'orange' as const,
  },
  {
    icon: 'MSG',
    title: '消息通知',
    description: '系统消息、协作通知，及时触达重要信息',
    tone: 'violet' as const,
  },
  {
    icon: 'SEC',
    title: '安全与备份',
    description: '数据安全加密存储，定期备份，防止数据丢失',
    tone: 'blue' as const,
  },
]
</script>

<template>
  <main class="page-shell" aria-label="从词开始建设中页面">
    <PortalBackground />

    <section class="hero">
      <div class="hero__top">
        <div class="hero__brand">
          <div class="brand-mark">
            <img src="/zr-logo.png" alt="从词开始标识" />
          </div>
          <div class="brand-copy">
            <h1>从词开始</h1>
            <p class="lead">提示词管理工具，让创作更高效，协作更简单</p>
          </div>
        </div>

        <div class="hero__characters" aria-hidden="true">
          <img class="character character--knight" src="/characters/knight.png" alt="" />
          <img class="character character--princess" src="/characters/princess.png" alt="" />
          <img class="character character--wizard" src="/characters/wizard.png" alt="" />
          <img class="character character--box" src="/characters/box.png" alt="" />
        </div>
      </div>

      <div class="construction-hero" aria-label="网站建设中">
        <strong>网站建设中</strong>
        <span>提示词管理工具正在打磨，更多能力即将上线</span>
      </div>
    </section>

    <section class="feature-section" aria-label="建设中的功能">
      <div class="feature-grid">
        <FeatureTile v-for="item in highlights" :key="item.title" v-bind="item" />
      </div>
    </section>

    <section class="footer-scene" aria-label="建设状态">
      <p>更多功能正在准备中</p>
    </section>
  </main>
</template>
