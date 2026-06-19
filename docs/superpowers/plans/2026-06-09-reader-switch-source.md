# 阅读页换源实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在阅读页右上角增加换源能力，让用户在当前源无章节或无正文时可以直接切换其它书源继续阅读。

**Architecture:** 后端基于当前书籍的书名和作者搜索其它启用书源，返回候选源；用户选择候选源后，后端把当前用户书架中的旧 `book_url` 替换为新源 `book_url`，保留阅读章节序号。前端阅读页展示换源抽屉，切换成功后跳转新书源并按原章节序号继续加载。

**Tech Stack:** Express、TypeScript、MySQL、Vue 3、Pinia、Element Plus、SSE 搜索引擎复用。

---

### Task 1: 后端可换书源查询

**Files:**
- Modify: `server/src/controllers/bookController.ts`
- Modify: `server/src/routes/book.ts`

- [ ] 新增 `getAlternateSources()`，根据当前书名搜索其它启用书源。
- [ ] 过滤当前源和当前 `bookUrl`。
- [ ] 优先返回书名和作者匹配的候选源，最多 30 条。

### Task 2: 后端切换书源

**Files:**
- Modify: `server/src/controllers/bookController.ts`
- Modify: `server/src/routes/book.ts`

- [ ] 新增 `switchBookSource()`。
- [ ] 写入或更新新源书籍。
- [ ] 把当前用户书架中的旧书 URL 更新为新书 URL。
- [ ] 保留原阅读章节序号和阅读进度字段。

### Task 3: 前端 API 和状态

**Files:**
- Modify: `web/src/api/index.ts`
- Modify: `web/src/store/book.ts`

- [ ] 增加 `AlternateSource` 类型。
- [ ] 增加 `getAlternateSources(bookUrl)`。
- [ ] 增加 `switchSource(oldBookUrl, newBook)`。

### Task 4: 阅读页 UI

**Files:**
- Modify: `web/src/views/Reader.vue`

- [ ] 右上角新增“换源”按钮。
- [ ] 增加候选源抽屉。
- [ ] 内容加载失败或无正文时显示“换源试试”按钮。
- [ ] 切换成功后跳转新 `bookUrl` 并按旧章节序号加载。

### Task 5: 验证

**Commands:**
- `npm run build` in `server`
- `npm run build` in `web`

- [ ] 后端构建通过。
- [ ] 前端构建通过。
- [ ] 重启开发服务。

### Task 6: 换源流式搜索优化

**Files:**
- Modify: `server/src/controllers/bookController.ts`
- Modify: `server/src/routes/book.ts`
- Modify: `web/src/api/index.ts`
- Modify: `web/src/store/book.ts`
- Modify: `web/src/views/Reader.vue`

- [ ] 新增 `GET /api/book/alternate-sources/stream?bookUrl=xxx` SSE 接口。
- [ ] 后端搜到一个候选源就立即发送 `result` 事件。
- [ ] 前端打开换源抽屉后立即使用 SSE 接收候选源。
- [ ] 前端默认只显示前 10 条，滚动到底部后每次多显示 10 条。
- [ ] 关闭换源抽屉时关闭 SSE，后端检测连接断开后停止搜索。
