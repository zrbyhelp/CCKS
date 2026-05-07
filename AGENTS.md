# 仓库指南

## 项目概述

网站名称为 **从词开始**。这是一个面向中国用户、中文优先且支持中英双语的提示词管理工具，统一管理图片生成类提示词、文本生成提示词和 Agent 提示词。核心能力包括变量、词汇变量、词汇库、工具管理、提示词文件化、文件结构、文件下载、版本迭代、社区分享、智能体工作流设计和上下文管理。

## 项目结构与模块组织

当前仓库处于脚手架阶段。参考素材放在 `参考/`，包括 `参考/参考.png` 和 `参考/人物参考/` 下的角色参考图。后续加入 Nuxt + TypeScript 后，页面放在 `pages/`，可复用组件放在 `components/`，共享逻辑放在 `composables/`，静态文件放在 `public/`，处理后的资源放在 `assets/`，测试文件放在被测代码旁或 `tests/` 下。

## 构建、测试与开发命令

当前仓库还没有 `package.json`，因此没有可执行脚本。完成 Nuxt 初始化后，按实际脚本使用：

- `npm install`：安装依赖。
- `npm run dev`：启动本地开发环境。
- `npm run build`：生成生产构建。
- `npm run preview`：本地预览构建结果。
- `npm run test`：运行测试套件（如果已配置）。

除非仓库新增对应锁文件，否则不要切换包管理器。

## 编码风格与命名规范

使用 Vue 单文件组件与 TypeScript，优先采用 `<script setup lang="ts">`。缩进统一为 2 个空格。组件使用 PascalCase，例如 `PromptCard.vue`；组合式函数使用 `use` 前缀，例如 `usePromptLibrary.ts`；页面文件遵循 Nuxt 路由命名。界面文案以中文为主，英文通过 i18n 统一管理，不要在模板里重复硬编码。

## 测试指南

当前尚未配置测试框架。后续加入测试时，建议单元测试使用 Vitest + Vue Test Utils，浏览器流程使用 Playwright。单测命名为 `*.spec.ts`，端到端测试命名为 `*.e2e.ts`。优先覆盖提示词文件处理、变量替换、文件版本管理、语言切换和响应式布局。

## 提交与 Pull Request 规范

当前工作区没有可参考的 Git 历史，因此默认采用 Conventional Commits，例如 `feat: add under-construction page` 或 `fix: correct mobile layout`。Pull Request 需包含简要说明、关联 issue（如有）、测试结果，以及 UI 改动截图。

## 安全与 Agent 说明

敏感信息放在 `.env` 中，只提交 `.env.example` 这类占位文件。不要提交私有提示词库、生成后的下载文件或未授权素材。需求不明确时，先向用户确认再实现。代码完成后不要自动启动站点，默认由用户在本地自行运行，除非用户明确要求你执行。
