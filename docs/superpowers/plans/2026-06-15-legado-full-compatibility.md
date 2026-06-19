# Legado Full Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按用户给定四级优先级增强目标站访问、规则解析、换源排序和 WebView 兜底，让服务端行为更接近阅读 3.0 原项目。

**Architecture:** 在已上线的 `sourceRequest()` 基础上补齐 `AnalyzeUrl` 语义，新增书源级并发门控、登录校验、`{{js}}` 模板执行和 retry；扩展 `ruleExecutor.ts` 的链式、XPath、Regex、JS、变量和 jsLib 能力；新增换源评分器并接入普通和流式换源；最后加固 Playwright WebView 兜底触发、限流和验证。

**Tech Stack:** Node.js 20、TypeScript、Express、Axios、Cheerio、xpath、jsonpath-plus、Playwright、MySQL/Redis。

---

### Task 1: AnalyzeUrl 兼容增强

**Files:**
- Modify: `server/src/services/sourceAccess/analyzeUrlOptions.ts`
- Modify: `server/src/services/sourceAccess/analyzeUrlOptions.test.ts`
- Modify: `server/src/services/sourceAccess/sourceRequest.ts`
- Test: `server/src/services/sourceAccess/sourceRequest.test.ts`

- [ ] Add failing tests for `{{js}}`, `{{key}}`, `{{page}}`, URL JSON options, retry, and login check.
- [ ] Implement template context with `key`, `page`, `baseUrl`, `origin`, `result`, `java`, and `cookie`.
- [ ] Execute `{{js}}` through `runSourceScript()` with a safe context.
- [ ] Preserve current encoding behavior for `{{key}}` and `{{page}}`.
- [ ] Add retry loop in `sourceRequest()` using parsed `retry`.
- [ ] Add `loginCheckJs` field to `SourceRequestSource` and evaluate it after HTTP/browser response.
- [ ] Run:

```powershell
npx tsx --test src/services/sourceAccess/analyzeUrlOptions.test.ts src/services/sourceAccess/sourceRequest.test.ts
```

Expected: PASS.

### Task 2: Per-source concurrentRate

**Files:**
- Create: `server/src/services/sourceAccess/sourceConcurrencyLimiter.ts`
- Create: `server/src/services/sourceAccess/sourceConcurrencyLimiter.test.ts`
- Modify: `server/src/services/sourceAccess/sourceRequest.ts`
- Modify: `server/src/services/webBookService.ts`

- [ ] Add failing test proving same-source requests with `concurrentRate=1` run serially.
- [ ] Implement a keyed async limiter by `bookSourceUrl`/origin.
- [ ] Pass `concurrentRate`, `bookSourceUrl`, and `bookSourceName` into `sourceRequest()`.
- [ ] Wrap HTTP/browser requests with the limiter.
- [ ] Run:

```powershell
npx tsx --test src/services/sourceAccess/sourceConcurrencyLimiter.test.ts src/services/webBookService.sourceRequest.test.ts
```

Expected: PASS.

### Task 3: RuleExecutor AnalyzeRule enhancement

**Files:**
- Modify: `server/src/services/ruleExecutor.ts`
- Modify: `server/src/services/ruleExecutor.test.ts`
- Create: `server/src/services/ruleContext.ts`
- Test: `server/src/services/ruleContext.test.ts`

- [ ] Add tests for `||`, `&&`, `%%`, XPath attributes, XPath text nodes, regex extraction, `@js`, `<js>`, `put/get`, and `jsLib`.
- [ ] Implement `RuleContext` with `put`, `get`, `result`, `baseUrl`, `source`, and `jsLib`.
- [ ] Make `||` return first non-empty result.
- [ ] Make `&&` merge results from all branches.
- [ ] Make `%%` run pipeline-style transformation over current results.
- [ ] Add regex extraction syntax support for `/pattern/group` and `##replace##with`.
- [ ] Pass `RuleContext` to all JS execution paths.
- [ ] Run:

```powershell
npx tsx --test src/services/ruleContext.test.ts src/services/ruleExecutor.test.ts
```

Expected: PASS.

### Task 4: replaceRegex compatibility

**Files:**
- Modify: `server/src/services/webBookService.ts`
- Modify: `server/src/services/ruleExecutor.ts`
- Test: `server/src/services/ruleExecutor.test.ts`

- [ ] Add tests for object, array, `pattern##replacement`, and plain regex replace forms.
- [ ] Implement a shared `applyReplaceRegex()` helper.
- [ ] Use it for search fields, chapter title cleanup, and content cleanup where source rules provide `replaceRegex`.
- [ ] Run:

```powershell
npx tsx --test src/services/ruleExecutor.test.ts
```

Expected: PASS.

### Task 5: 换源评分器

**Files:**
- Create: `server/src/services/alternateSourceScoring.ts`
- Create: `server/src/services/alternateSourceScoring.test.ts`
- Modify: `server/src/controllers/book/sourceSwitchController.ts`
- Modify: `server/src/services/readabilityVerification.ts`

- [ ] Add tests for name exact match, author exact/contains match, source weight, health, toc count, current chapter readable, nearby chapter readable, word count, and current source penalty.
- [ ] Implement `scoreAlternateSource()` returning `score` and `reasons`.
- [ ] Extend readability verification to return `tocCount`, `currentReadable`, `nearbyReadable`, and `contentLength`.
- [ ] Attach `_switchScore` and `_switchScoreReasons` to returned source candidates.
- [ ] Sort both JSON and SSE换源 by `_switchScore` descending.
- [ ] Run:

```powershell
npx tsx --test src/services/alternateSourceScoring.test.ts
```

Expected: PASS.

### Task 6: WebView兜底加固

**Files:**
- Modify: `server/src/services/sourceAccess/browserSourceClient.ts`
- Modify: `server/src/services/sourceAccess/browserSourceClient.test.ts`
- Modify: `server/src/services/sourceAccess/sourceRequest.ts`

- [ ] Add tests for empty parsed result trigger, 403/429/503 trigger, `webView=true` trigger, and concurrency rejection.
- [ ] Keep HTTP first unless `webView=true`.
- [ ] Use browser fallback when HTTP result is防爬页 or caller says parsed result is empty.
- [ ] Keep existing Chromium executable-path fallback.
- [ ] Run:

```powershell
npx tsx --test src/services/sourceAccess/browserSourceClient.test.ts src/services/sourceAccess/sourceRequest.test.ts
```

Expected: PASS.

### Task 7: Build, deploy, verify

**Files:**
- Modify: `server/dist`
- Modify: `update_tmp/update.zip`
- Modify: `update_tmp/update.zip.sig`

- [ ] Run full targeted tests:

```powershell
npx tsx --test src/services/sourceAccess/analyzeUrlOptions.test.ts src/services/sourceAccess/sourceRequest.test.ts src/services/sourceAccess/sourceConcurrencyLimiter.test.ts src/services/ruleContext.test.ts src/services/ruleExecutor.test.ts src/services/alternateSourceScoring.test.ts src/services/webBookService.sourceRequest.test.ts
```

- [ ] Run build:

```powershell
npm run build
```

- [ ] Pack and deploy update through existing admin update API.
- [ ] Verify:

```powershell
node -e "fetch('https://so.soumal.com/api/health').then(r=>r.text().then(t=>console.log(r.status,t)))"
```

- [ ] Verify普通搜索、换源搜索、正文读取 and browser smoke.

Expected: health正常，普通搜索有结果，换源排序包含 `_switchScore`，正文读取不回归。

---

## Self-review

- Spec coverage: 覆盖用户给出的四个优先级。
- Scope check: 四个优先级互相关联，但可以按访问层、规则引擎、换源排序、WebView兜底顺序分批验证。
- Placeholder scan: 没有待填写项。
- Type consistency: 计划中的函数和文件均对应当前项目结构。
