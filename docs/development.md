# 从词开始开发文档

## 项目定位

从词开始是提示词文件化编辑与管理工作台。当前前端使用 Next.js App Router、React、TypeScript 和 Tailwind CSS，核心入口为 `app/page.tsx` 与 `components/workbench-shell.tsx`。项目文件保存在 `CCKS_PROJECT_ROOT`，项目元数据保存在 Prisma 管理的数据库中。

## 本地开发

```bash
npm install
npm run dev:local
```

`dev:local` 使用 SQLite 便于本地开发。连接 MySQL 时使用：

```bash
npm run db:push
npm run dev
```

提交前建议执行：

```bash
npm run typecheck
npm run build
```

## 关键目录

- `app/api/projects/`：项目、文件、导入导出、源代码管理等接口。
- `components/workbench-shell.tsx`：工作台主界面、文件树、编辑器、测试面板和指令集。
- `lib/project-store.ts`：项目元数据与本地文件操作。
- `lib/project-archive.ts`：ZIP 导入、导出、单文件下载和路径安全校验。
- `lib/ai-presets.ts`、`lib/tool-definitions.ts`：模型能力、响应参数和工具定义。
- `prisma/`：MySQL 与 SQLite schema。

## 文件与安全边界

所有项目文件操作都必须先解析用户项目目录，再通过安全路径函数限制在项目根目录内。ZIP 导入导出默认排除 `.git`、`node_modules`、`.next`、`.turbo`、`.import-*`、`.DS_Store` 和 `Thumbs.db`。

浏览器侧 GitHub token 只允许保存在 `localStorage.ccks-github-session`，不要写入数据库。供应商密钥、系统 AI 设置和用户 API token 都应通过服务端接口处理，不要泄露到普通用户可见的项目文件中。

## 开发约定

- 中文文案优先，保留英文翻译。
- UI 遵循 VS Code 风格的工作台密度，避免营销页式大卡片布局。
- 新增项目文件接口时同步考虑导入导出、路径校验和源代码管理刷新。
- 涉及数据库 schema 变更时同步更新 MySQL 与 SQLite schema，并运行 Prisma 生成或 `db:push`。

## 社区与支持

项目说明文档中的捐赠入口位于根目录 `README.md`，图片资源保存在 `捐赠/` 目录。捐赠仅用于自愿支持项目维护，不代表商业授权或服务承诺。

认可并感谢 LINUX DO 社区对开源交流与分享氛围的推动。维护项目文案时，应保留这类对社区贡献的明确致谢。

## 来源说明维护规则

`README.md` 中的来源说明用于明确项目内容边界：

- 代码来源为本项目需求驱动下的本地实现。
- 配方变量、模板与默认提示词来自用户提供数据的人工整理、蒸馏和扩充。
- 捐赠图片来自仓库 `捐赠/` 目录。
- 社区致谢不应写成官方背书、合作声明或授权声明。
