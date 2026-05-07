export default defineNuxtConfig({
  compatibilityDate: '2026-05-06',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-CN',
      },
      title: '从词开始 - 网站建设中',
      meta: [
        {
          name: 'description',
          content:
            '从词开始是一个面向中国用户的提示词管理工具，支持图片生成、文本生成、Agent 提示词与文件化管理。',
        },
        { name: 'theme-color', content: '#f7fbff' },
      ],
    },
  },
})
