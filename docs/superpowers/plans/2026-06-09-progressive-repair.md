# 渐进式修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复项目的构建、配置、安全、测试、迁移、类型和前端打包问题，让前后端可以稳定构建并具备更清晰的维护边界。

**Architecture:** 采用渐进式修复：先恢复后端 TypeScript 构建，再同步文档和配置；随后把书源 JS 执行与规则解析拆出独立模块，补充 Jest 测试；最后加入数据库迁移基础能力、前端响应类型和 Vite 分包配置。所有改动尽量保持现有 API 兼容。

**Tech Stack:** Node.js、Express、TypeScript、Jest、MySQL、Vue 3、Vite、Pinia、Axios、Element Plus。

---

### Task 1: 后端编译修复

**Files:**
- Modify: `server/src/controllers/bookController.ts`

- [ ] 给 `Promise.race()` 搜索结果增加明确数组类型。
- [ ] 执行 `npm run build`，期望 TypeScript 编译通过。

### Task 2: 文档与环境配置同步

**Files:**
- Modify: `README.md`
- Modify: `README_WEB.md`
- Modify: `server/.env.example`

- [ ] 将数据库说明统一为 MySQL。
- [ ] 修正后端端口和 Vite 代理端口描述。
- [ ] 删除当前项目不存在的 Docker 部署说明。

### Task 3: JS 规则安全执行与规则模块拆分

**Files:**
- Create: `server/src/services/ruleExecutor.ts`
- Create: `server/src/services/safeScriptRunner.ts`
- Modify: `server/src/services/webBookService.ts`
- Modify: `server/src/config/index.ts`

- [ ] 把规则执行函数移动到 `ruleExecutor.ts`。
- [ ] 把 JS 规则执行封装到 `safeScriptRunner.ts`。
- [ ] 增加 `ENABLE_SOURCE_JS` 配置，默认关闭书源 JS 规则。
- [ ] 为规则执行模块增加 Jest 测试。

### Task 4: 数据库迁移基础

**Files:**
- Create: `server/src/config/migrations.ts`
- Create: `server/src/migrations/001_init_schema.ts`
- Modify: `server/src/config/database.ts`

- [ ] 增加 `schema_migrations` 表。
- [ ] 在 `initDatabase()` 内运行迁移。
- [ ] 保留当前建表逻辑，避免破坏现有数据库。

### Task 5: 前端响应类型统一

**Files:**
- Modify: `web/src/api/index.ts`
- Modify: `web/src/store/auth.ts`
- Modify: `web/src/store/book.ts`

- [ ] 增加 `ApiResponse<T>` 和 `unwrapResponse<T>()`。
- [ ] API 层统一返回解包后的 `data`。
- [ ] Store 层减少 `res.data || res` 兼容写法。

### Task 6: 前端分包优化

**Files:**
- Modify: `web/vite.config.ts`

- [ ] 增加 `build.rollupOptions.output.manualChunks`。
- [ ] 将 Vue、Element Plus、Axios 等拆分成独立 chunk。
- [ ] 执行前端构建，确认构建通过。

### Task 7: 清理过期文件和验证

**Files:**
- Review: `server/data.db`
- Review: `server/data/legado.db`
- Review: `server/dist`
- Review: `web/dist`

- [ ] 只清理确定属于构建产物或过期描述的内容。
- [ ] 不删除未确认用途的数据文件。
- [ ] 执行后端测试、后端构建、前端构建。
