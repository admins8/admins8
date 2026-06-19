# API 探测生成书源 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有书源生成器中增加 API 探测模式，支持输入首页/书库页后发现公开 JSON API、编辑请求头并生成接口型书源 JSON。

**Architecture:** 后端继续以 `sourceGenerator.ts` 为核心，新增 API 候选提取、JSONPath 推断和请求头合并函数。前端在现有生成弹窗中增加模式选择和请求头 JSON 编辑框，继续复用复制 JSON 与一键导入流程。

**Tech Stack:** Node.js、TypeScript、axios、cheerio、Vue 3、Element Plus。

---

## File Map

- Modify `server/src/services/sourceGenerator.ts`：新增 API 探测、JSONPath 推断、请求头合并。
- Modify `server/src/services/sourceGenerator.test.ts`：新增 API 探测和 JSONPath 推断测试。
- Modify `server/src/controllers/sourceController.ts`：透传 `mode` 和 `headers`。
- Modify `web/src/api/index.ts`：扩展 `GenerateSourceParams`。
- Modify `web/src/views/SourceList.vue`：增加模式选择、请求头编辑、请求头校验。

## Task 1: 后端 API 规则推断

- [ ] 在 `server/src/services/sourceGenerator.test.ts` 写失败测试：`extractApiCandidatesFromHtml detects api search urls from scripts`，输入包含 `fetch('/api/search?keyword=')` 的 HTML，期望返回 `/api/search?keyword={{key}}`。
- [ ] 运行 `npm test -- --test-name-pattern 'extractApiCandidatesFromHtml'`，期望函数不存在而失败。
- [ ] 在 `server/src/services/sourceGenerator.ts` 实现并导出 `extractApiCandidatesFromHtml(baseUrl, html)`。
- [ ] 重新运行同一测试，期望通过。
- [ ] 写失败测试：`inferJsonSearchRule detects common novel api response fields`，输入 `{ data: [{ novelName, authorName, novelId, cover, summary }] }`，期望 `bookList = '$.data[*]'`，`name = '$.novelName'`，`author = '$.authorName'`，`bookUrl = '/novel/{{$.novelId}}'`。
- [ ] 运行测试，期望函数不存在而失败。
- [ ] 实现并导出 `inferJsonSearchRule(payload)`。
- [ ] 重新运行测试，期望通过。

## Task 2: 后端 API 模式生成

- [ ] 在 `server/src/services/sourceGenerator.test.ts` 写失败测试：`buildApiSource creates importable jsonpath source`，调用 `buildApiSource`，断言 `searchUrl`、`ruleSearch.bookList`、`ruleSearch.name` 和 `header`。
- [ ] 运行测试，期望函数不存在而失败。
- [ ] 在 `sourceGenerator.ts` 实现 `buildApiSource`，复用 `buildDefaultSource`，但允许 JSONPath 规则和自定义 header。
- [ ] 重新运行测试，期望通过。
- [ ] 扩展 `GenerateSourceInput` 支持 `mode?: 'html' | 'api'` 和 `headers?: Record<string, string>`。
- [ ] 修改 `generateBookSource`：当 `mode === 'api'` 时走 API 探测分支，失败时返回基础草稿和诊断。

## Task 3: 控制器与前端 API

- [ ] 修改 `sourceController.ts`：读取 `mode` 与 `headers` 并传给 `generateBookSource`。
- [ ] 修改 `web/src/api/index.ts`：`GenerateSourceParams` 增加 `mode?: 'html' | 'api'` 和 `headers?: Record<string, string>`。
- [ ] 运行 `npm run build` in `server`，期望通过。

## Task 4: 前端生成弹窗

- [ ] 修改 `SourceList.vue`：`generateForm` 增加 `mode: 'html'` 和 `headersText`。
- [ ] 在弹窗中增加单选按钮“网页模式 / API 探测模式”。
- [ ] API 探测模式下展示请求头编辑框，默认填入 JSON 模板。
- [ ] `handleGenerateSource` 中解析请求头 JSON，格式错误时提示“请求头 JSON 格式不正确”。
- [ ] 调用 `sourceApi.generateSource` 时传入 `mode` 和 `headers`。
- [ ] 运行 `npm run build` in `web`，期望通过。

## Task 5: 验证

- [ ] 运行 `npm test -- --test-name-pattern 'extractApiCandidatesFromHtml|inferJsonSearchRule|buildApiSource|buildDefaultSource|buildSearchCandidates|inferSearchRulesFromHtml|buildFallbackGenerationResult'`。
- [ ] 运行 `npm run build` in `server`。
- [ ] 运行 `npm run build` in `web`。
- [ ] 手动验证生成弹窗：网页模式仍能生成；API 探测模式能提交请求头 JSON；错误 JSON 会被前端拦截。
