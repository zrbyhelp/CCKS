# ccks

**ccks** 是新时代 AI 代码编辑工具以及编辑框架。当前实现以中文为主，支持中英双语，提供项目文件树、代码编辑、Markdown 预览、AI 辅助、测试面板、变量检查、工具管理、源代码管理和统一门户对接。

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

文件树支持打开、保存、重命名、删除、新建文件夹、新建提示词文件、多选、项目内拖拽移动、外部文件/文件夹拖入上传、ZIP 项目导入导出、右键打包下载，并根据 Git 状态显示颜色与标记。GitHub OAuth 只把 access token 写入浏览器 `localStorage.ccks-github-session`，不写入 MySQL。源代码管理面板读取用户项目目录内的 Git 状态，支持初始化、暂存/取消暂存、丢弃、差异查看、提交、fetch、pull、push、sync、分支切换、设置 remote、发布到 GitHub 和从 GitHub 导入。

## 本地运行

无 Docker/MySQL 时可以使用本地 SQLite 模式：

```bash
npm install
npm run dev:local
```

`dev:local` 会先执行 SQLite `db push` 并生成 Prisma Client，默认数据库文件为 `.ccks-local/dev.db`。如需自定义位置，可设置：

```env
CCKS_SQLITE_DATABASE_URL=file:./.ccks-local/dev.db
```

使用 MySQL 时：

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
CCKS_DATABASE_MODE=mysql
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
CCKS_PUBLIC_URL=https://your-domain.com
```

Docker Compose 默认启动 MySQL，并在应用启动前执行 `prisma db push`。容器内数据库连接默认使用：

```env
DATABASE_URL=mysql://ccks:ccks_password@mysql:3306/ccks
CCKS_PROJECT_ROOT=/data/ccks-projects
```

如需对接统一门户，继续配置：

```env
CCKS_PUBLIC_URL=https://your-domain.com
NEXT_PUBLIC_ZR_PORTAL_URL=https://portal.example.com
NEXT_PUBLIC_ZR_SERVICE_SLUG=ccks
ZR_CLIENT_ID=your-client-id
ZR_CLIENT_SECRET=your-client-secret
ZR_CALLBACK_URL=https://your-domain.com/api/auth/callback
LOCAL_AUTH_BYPASS=false
SESSION_SECRET=change-me-to-a-long-random-string
CCKS_ADMIN_ACCOUNTS=admin_account_1,admin_account_2
CCKS_ADMIN_EMAILS=admin@example.com
```

管理员账号通过 `CCKS_ADMIN_ACCOUNTS` 和 `CCKS_ADMIN_EMAILS` 维护，多个值用英文逗号分隔。统一登录成功后，`/api/session` 会根据当前用户的账号或邮箱返回 `admin` 信息；`LOCAL_AUTH_BYPASS=true` 时本地开发用户默认具备管理员身份。

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
- `/api/session`：返回当前用户信息和管理员身份。
- `/api/announcements`：使用服务端凭据拉取门户公告。
- `/api/projects`：读取或创建项目。
- `/api/projects/files`：读取和保存项目文件。
- `/api/projects/archive`：导出整个项目、所选文件 ZIP，或单文件原始下载。
- `/api/projects/import-zip`：从 ZIP 导入并创建新项目。
- `/api/projects/upload`：上传本机文件或拖入文件夹内容到项目目录。
- `/api/projects/entries/move`：移动项目内文件或文件夹位置。
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
- `docs/development.md`：开发说明。
- `docs/import-export.md`：项目导入导出与文件拖拽说明。
- `components.json`：shadcn/ui 配置。
- `tailwind.config.ts`：Tailwind 配置。

## 许可证

本项目使用自定义非商用源码许可证，允许自用、学习、评估和内部非商用使用，禁止未经授权的商用盈利、付费托管、售卖或作为商业 SaaS/产品的一部分使用。完整条款见 `LICENSE`。项目所有者保留自行商业化本网站、软件和相关服务的权利。

## 来源说明

- 项目代码由项目维护者围绕“从词开始”工作台需求实现，包含提示词文件编辑、变量管理、测试运行、AI 辅助、导入导出和源代码管理等功能。
- 配方变量、模板与默认提示词内容基于用户提供的实验提示词数据进行人工阅读、整理、蒸馏和扩充；整理过程不依赖第三方 AI 服务调用。
- 捐赠图片来自本仓库根目录 `捐赠/` 文件夹，仅用于项目说明页展示。
- LINUX DO 相关内容为社区致谢说明，用于认可其对开源交流与分享氛围的推动，不表示本项目由该社区官方背书或发布。

## 支持项目

如果这个项目对你的学习、研究或自用工作流有帮助，可以通过下面的捐赠码支持后续维护。捐赠完全自愿，不构成商业授权、付费服务承诺或功能交付承诺；商业使用仍需遵守 `LICENSE` 中的授权限制。

<p>
  <img src="./捐赠/微信图片_20260511124938_184_76.jpg" alt="捐赠码 1" width="220" />
  <img src="./捐赠/微信图片_20260511124939_185_76.jpg" alt="捐赠码 2" width="220" />
</p>

## 鸣谢

认可并感谢 LINUX DO 社区对开源交流与分享氛围的推动。社区中持续的技术讨论、经验分享和互助实践，为个人开发者和开源项目提供了重要的交流土壤。

## 注意事项

当前项目已从 Nuxt 迁移到 Next.js，不再使用 Vue/Nuxt 入口。提交前建议运行：

```bash
npm run typecheck
npm run build
docker compose config
```

Git 操作始终使用 `--git-dir <用户项目>/.git --work-tree <用户项目>` 限定在用户项目目录内，不读取或修改当前应用工程仓库。`丢弃更改` 会还原或删除未跟踪文件，前端会要求确认。
