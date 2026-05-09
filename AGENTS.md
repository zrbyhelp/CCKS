# Repository Guidelines

## 项目概述

网站名称为 **从词开始**。本仓库实现提示词文件化编辑与管理工作台，面向图片生成、文本生成和 Agent 提示词。界面中文为主，支持中英切换，布局参考 VS Code 风格：项目文件树、Monaco 编辑区、Markdown 预览/AI 辅助、测试面板、检查器、工具和源代码管理。

## 技术栈

当前框架为 **Next.js App Router + TypeScript**，样式使用 **Tailwind CSS**，基础组件按 **shadcn/ui** 风格组织。核心库包括 Monaco Editor、react-arborist、React Hook Form、Zod、TanStack Table、React Flow、Radix UI、lucide-react、Prisma 和 MySQL。不要新增 Nuxt/Vue 入口。

## 项目结构

- `app/`：Next.js 路由、根布局和全局样式，首页入口为 `app/page.tsx`。
- `components/`：业务组件和 `components/ui/` 下的基础 UI 组件。
- `lib/`：会话、项目文件、Git 和 Prisma 工具。
- `prisma/`：MySQL 数据模型，项目元数据保存在 `Project` 表。
- `public/`：静态资源，包括品牌 logo 和背景素材。
- `Dockerfile`、`docker-compose.yml`：生产部署配置。

## 开发与构建命令

- `npm install`：安装依赖并更新 `package-lock.json`。
- `npm run dev`：启动 Next.js 本地开发服务。
- `npm run build`：生成 Prisma Client 并执行生产构建。
- `npm run start`：运行生产构建。
- `npm run typecheck`：执行 TypeScript 类型检查。
- `npm run db:push`：将 Prisma schema 同步到 MySQL。
- `docker compose up --build -d`：使用 Docker Compose 构建并启动服务。

端口通过 `.env` 中的 `PORT` 配置。项目文件存储在 `CCKS_PROJECT_ROOT`，项目元数据使用 `DATABASE_URL` 指向 MySQL。GitHub OAuth token 只写入浏览器 `localStorage`，不要写入数据库。

## 编码规范

使用 TypeScript、React 函数组件和 App Router 约定。组件命名使用 PascalCase，工具函数使用 camelCase。样式优先使用 Tailwind class；可复用 UI 放入 `components/ui/`，优先沿用已有 shadcn 风格组件。保持中文文案为主。

## 测试与验证

当前没有单元测试框架。提交前至少运行 `npm run typecheck` 和 `npm run build`。涉及数据库时运行 `npm run db:push`；涉及 Docker 配置时运行 `docker compose config`。重点检查文件树打开/保存、项目新增、GitHub 导入、亮暗主题、中英切换和拖拽布局。

## 安全与 Agent 说明

敏感信息放入 `.env`，只提交 `.env.example`。不要提交私有提示词库、生成下载物、GitHub token 或未授权素材。需求不明确时先向用户确认。代码完成后默认由用户自行运行，除非用户明确要求启动服务。
