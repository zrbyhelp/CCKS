# ZPMT

**ZPMT** 是新时代 AI 代码编辑工具以及编辑框架。当前实现以中文为主，支持中英双语，提供项目文件树、代码编辑、Markdown 预览、AI 辅助、测试面板、变量检查、工具管理、源代码管理和统一门户对接。

## 技术栈

- Next.js App Router + React + TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- Monaco Editor：Prompt 编辑器
- react-arborist：项目文件树
- React Hook Form + Zod：变量输入表单
- TanStack Table：变量表格
- React Flow：依赖关系视图
- Prisma + MySQL：项目元数据
- Docker Compose：应用、MySQL 和项目文件卷

## 当前功能

首页 `app/page.tsx` 渲染 `components/workbench-shell.tsx`。工作台支持拖拽布局、最小化窗体、还原默认布局、亮色/暗色模式和中英切换。左侧项目区采用 VS Code 风格 Activity Bar，可在文件列表和源代码管理之间切换；项目元数据写入 MySQL，项目文件存储在 `CCKS_PROJECT_ROOT`。

文件树支持打开、保存、重命名、删除、新建文件夹、新建提示词文件，并根据 Git 状态显示颜色与标记。GitHub OAuth 只把 access token 写入浏览器 `localStorage.ccks-github-session`，不写入 MySQL。源代码管理面板读取用户项目目录内的 Git 状态，支持初始化、暂存/取消暂存、丢弃、差异查看、提交、fetch、pull、push、sync、分支切换、设置 remote、发布到 GitHub 和从 GitHub 导入。

## 本地运行

```bash
npm install
npm run db:push
npm run dev
```

生产构建：

```bash
npm run typecheck
npm run build
npm run start
```

本地直连 MySQL 时，`DATABASE_URL` 应指向可访问的数据库，例如：

```env
DATABASE_URL=mysql://ccks:ccks_password@localhost:3306/ccks
CCKS_PROJECT_ROOT=.ccks-projects
```

## Docker 部署

复制环境变量示例：

```bash
cp .env.example .env
```

`.env` 中至少配置端口：

```env
PORT=3000
```

Docker Compose 默认启动 MySQL，并在应用启动前执行 `prisma db push`。容器内数据库连接默认使用：

```env
DATABASE_URL=mysql://ccks:ccks_password@mysql:3306/ccks
CCKS_PROJECT_ROOT=/data/ccks-projects
```

如需对接统一门户，继续配置：

```env
NEXT_PUBLIC_ZR_PORTAL_URL=https://portal.example.com
NEXT_PUBLIC_ZR_SERVICE_SLUG=ccks
ZR_CLIENT_ID=your-client-id
ZR_CLIENT_SECRET=your-client-secret
ZR_CALLBACK_URL=https://your-domain.com/api/auth/callback
LOCAL_AUTH_BYPASS=false
```

如需 GitHub 导入、发布和推送，先在 <https://github.com/settings/developers> 创建 OAuth App，并配置：

```env
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_CALLBACK_URL=https://your-domain.com/api/github/callback
```

本地开发时 GitHub OAuth App 可使用：

```text
Homepage URL: http://localhost:3000
Authorization callback URL: http://localhost:3000/api/github/callback
```

当前 GitHub 授权 scope 使用 `repo`。如果浏览器缓存里已有旧 token 但缺少 `repo` scope，需要重新连接 GitHub。

相关接口：

- `/api/auth/login`：跳转统一登录。
- `/api/auth/callback`：接收统一登录回调并写入最小 session cookie。
- `/api/session`：返回当前用户信息。
- `/api/announcements`：使用服务端凭据拉取门户公告。
- `/api/projects`：读取或创建项目。
- `/api/projects/files`：读取和保存项目文件。
- `/api/projects/import-github`：使用浏览器传入的 GitHub token 克隆仓库；导入先克隆到临时目录，成功后再写入项目。
- `/api/projects/source-control`：读取 Git 状态、分组、文件装饰、分支和 remote。
- `/api/projects/source-control/actions`：执行 init、stage、unstage、discard、commit、fetch、pull、push、sync、branch、remote、publish。
- `/api/projects/source-control/diff`：读取 SCM 文件差异，用 Monaco DiffEditor 展示。
- 投诉建议弹窗：打开 `${NEXT_PUBLIC_ZR_PORTAL_URL}/feedback?service_slug=...&embed=1`。

启动服务：

```bash
docker compose up --build -d
```

停止服务：

```bash
docker compose down
```

## 目录说明

- `app/`：Next.js 页面、布局和全局样式。
- `components/`：工作台组件和基础 UI 组件。
- `lib/`：会话、项目文件、Git、Prisma 和通用工具。
- `prisma/`：MySQL schema。
- `public/`：静态图片与品牌资源。
- `components.json`：shadcn/ui 配置。
- `tailwind.config.ts`：Tailwind 配置。

## 注意事项

当前项目已从 Nuxt 迁移到 Next.js，不再使用 Vue/Nuxt 入口。提交前建议运行：

```bash
npm run typecheck
npm run build
docker compose config
```

Git 操作始终使用 `--git-dir <用户项目>/.git --work-tree <用户项目>` 限定在用户项目目录内，不读取或修改当前应用工程仓库。`丢弃更改` 会还原或删除未跟踪文件，前端会要求确认。
