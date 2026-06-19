# 书源订阅与安全加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除手工添加/生成书源，新增订阅源导入、浏览、阅读能力，并完成本地安全加固和关键拆分。

**Architecture:** 订阅源独立于小说书源，以 `rss_sources` 表和 `/api/rss-sources` API 管理。前端先在书源管理页增加“订阅源”标签页，后续可再抽成独立后台菜单；安全加固保持兼容现有调用方。

**Tech Stack:** Express、TypeScript、MySQL、Redis、Vue 3、Vite、Element Plus、Vitest、Node test runner。

---

### Task 1: 后端订阅源模型与导入

**Files:**
- Create: `server/src/services/rssSourceService.ts`
- Create: `server/src/services/rssSourceService.test.ts`
- Create: `server/src/migrations/020_rss_sources.ts`
- Modify: `server/src/config/migrations.ts`
- Create: `server/src/controllers/rssSourceController.ts`
- Create: `server/src/routes/rssSource.ts`
- Modify: `server/src/app.ts`

- [ ] 写 `rssSourceService.test.ts`，覆盖单源、集合、无效占位项。
- [ ] 运行 `npm test -- src/services/rssSourceService.test.ts`，确认失败。
- [ ] 实现 `normalizeRssImportPayload`、`normalizeRssSourceRow`、`importRssSourcesFromUrl`。
- [ ] 新增 `020_rss_sources` 迁移并接入迁移列表。
- [ ] 新增 `/api/rss-sources` 路由和控制器。
- [ ] 运行后端测试确认通过。

### Task 2: 书源管理删除添加/生成

**Files:**
- Modify: `server/src/routes/source.ts`
- Modify: `server/src/controllers/sourceController.ts`
- Modify: `web/src/views/SourceList.vue`
- Modify: `web/src/api/sourceApi.ts`

- [ ] 删除 `/api/sources/generate` 和 `POST /api/sources` 路由。
- [ ] 保留 `/api/sources/import`、`/api/sources/import-url`、编辑、验证、删除。
- [ ] 删除前端“添加书源”和“生成书源”按钮、弹窗、状态和 API 方法。
- [ ] 保留编辑弹窗，但只能从列表“编辑”打开。

### Task 3: 安全加固

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/services/ruleExecutor.ts`
- Modify: `server/src/services/ruleExecutor.test.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/middleware/auth.ts`
- Modify: `server/src/controllers/uploadController.ts`
- Create: `server/src/controllers/uploadController.test.ts`
- Modify: `server/src/config/database.ts`
- Modify: `server/src/config/migrations.ts`

- [ ] 新增 XPath 测试，确认 XPath 规则还能解析文本。
- [ ] 替换 `xmldom` 为 `@xmldom/xmldom`。
- [ ] 给认证路由添加限流。
- [ ] 移除 `authMiddleware` query token。
- [ ] 新增 SVG 上传拒绝测试并实现白名单调整。
- [ ] 关闭普通连接 `multipleStatements`，迁移内多语句拆分执行。

### Task 4: 前端 API 拆分

**Files:**
- Create: `web/src/api/request.ts`
- Create: `web/src/api/types.ts`
- Create: `web/src/api/authApi.ts`
- Create: `web/src/api/bookApi.ts`
- Create: `web/src/api/sourceApi.ts`
- Create: `web/src/api/rssSourceApi.ts`
- Create: `web/src/api/adminApi.ts`
- Create: `web/src/api/configApi.ts`
- Modify: `web/src/api/index.ts`
- Modify: `web/src/api/index.test.ts`

- [ ] 先建立模块文件并从 `index.ts` 聚合导出。
- [ ] 逐步迁移认证、书籍、书源、订阅源、后台和配置 API。
- [ ] 保持现有导入路径 `@/api` 可用。
- [ ] 运行前端测试。

### Task 5: 订阅源 UI 与阅读

**Files:**
- Create: `web/src/views/source/BookSourcePanel.vue`
- Create: `web/src/views/source/RssSourcePanel.vue`
- Create: `web/src/views/source/RssArticleReader.vue`
- Modify: `web/src/views/SourceList.vue`
- Modify: `web/src/router/index.ts` if a standalone route is needed

- [ ] 拆出小说书源面板。
- [ ] 增加订阅源面板，支持导入单源/集合、列表、删除、启用。
- [ ] 增加文章列表和内容阅读弹窗。
- [ ] 增加页面级测试，确认添加/生成入口消失，订阅源入口存在。

### Task 6: 后端书源服务拆分

**Files:**
- Create: `server/src/services/bookSourceHttpClient.ts`
- Create: `server/src/services/bookRuleParser.ts`
- Create: `server/src/services/bookSearchService.ts`
- Create: `server/src/services/bookReaderService.ts`
- Modify: `server/src/services/webBookService.ts`
- Modify: related tests under `server/src/services`

- [ ] 先抽 HTTP 请求与 header 构建。
- [ ] 再抽规则解析兼容导出。
- [ ] 再抽搜索解析。
- [ ] 最后让 `webBookService.ts` 保持兼容门面。
- [ ] 每步运行相关后端测试。

### Task 7: 运行产物清理边界

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `README_WEB.md`

- [ ] 明确 `server/data`、`release`、`web/dist.old.*`、上传、备份、更新包属于运行/发布产物。
- [ ] 只更新忽略规则和文档，不删除用户可能需要的备份文件。

### Verification

- [ ] `npm test` in `server`
- [ ] `npm run build` in `server`
- [ ] `npm test` in `web`
- [ ] `npm run build` in `web`
- [ ] 手动确认书源管理页入口：无“添加书源”“生成书源”，有“书源导入”“订阅源导入”
- [ ] 不执行服务器同步
