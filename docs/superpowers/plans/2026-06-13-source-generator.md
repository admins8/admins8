# 自动生成单个书源 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在书源管理中增加“生成书源”功能，支持输入网站 URL 后生成单个书源 JSON、复制 JSON、一键导入。

**Architecture:** 后端新增独立 `sourceGenerator` 服务负责探测站点和生成书源 JSON，`sourceController` 只暴露接口。前端在 `SourceList.vue` 增加生成弹窗，复用现有 API 客户端和添加书源接口完成一键导入。

**Tech Stack:** Node.js、TypeScript、Express、axios、cheerio、Vue 3、Element Plus。

---

## File Map

- Create `server/src/services/sourceGenerator.ts`：生成单个书源 JSON、搜索地址候选、规则推断、诊断信息。
- Create `server/src/services/sourceGenerator.test.ts`：覆盖 URL 校验、基础 JSON 生成、搜索候选生成、HTML 规则推断。
- Modify `server/src/controllers/sourceController.ts`：新增 `generateSource` 控制器。
- Modify `server/src/routes/sourceRoutes.ts`：新增 `POST /api/sources/generate` 路由。
- Modify `web/src/api/index.ts`：新增生成接口类型和 `sourceApi.generateSource`。
- Modify `web/src/views/SourceList.vue`：新增“生成书源”按钮、弹窗、复制 JSON、一键导入。

## Task 1: 后端生成服务

**Files:**
- Create: `server/src/services/sourceGenerator.ts`
- Test: `server/src/services/sourceGenerator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/services/sourceGenerator.test.ts` with tests for:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultSource,
  buildSearchCandidates,
  inferSearchRulesFromHtml,
} from './sourceGenerator';

test('buildDefaultSource creates importable source JSON', () => {
  const source = buildDefaultSource({
    url: 'http://www.xqishuta.org/',
    name: '奇书网',
    searchUrl: '/search?keyword={{key}}',
    ruleSearch: {
      bookList: 'li',
      name: 'a@text',
      author: '',
      bookUrl: 'a@href',
    },
  });

  assert.equal(source.bookSourceName, '奇书网');
  assert.equal(source.bookSourceUrl, 'http://www.xqishuta.org');
  assert.equal(source.searchUrl, '/search?keyword={{key}}');
  assert.equal(source.ruleSearch.bookList, 'li');
  assert.equal(source.ruleToc.chapterList, 'dd a');
  assert.equal(source.ruleContent.content, '#content@html||.content@html||.chapter-content@html');
});

test('buildSearchCandidates returns common static site search URLs', () => {
  const candidates = buildSearchCandidates('http://www.xqishuta.org/', '诡秘之主');

  assert.ok(candidates.some((item) => item.template === '/search?keyword={{key}}'));
  assert.ok(candidates.some((item) => item.template === '/modules/article/search.php?searchkey={{key}}'));
  assert.ok(candidates.every((item) => item.url.startsWith('http://www.xqishuta.org/')));
});

test('inferSearchRulesFromHtml detects repeated list links', () => {
  const html = `
    <ul class="book-list">
      <li><a href="/book/1.html">诡秘之主</a><span class="author">爱潜水的乌贼</span></li>
      <li><a href="/book/2.html">宿命之环</a><span class="author">爱潜水的乌贼</span></li>
    </ul>
  `;

  const rules = inferSearchRulesFromHtml(html);

  assert.equal(rules.bookList, '.book-list li');
  assert.equal(rules.name, 'a@text');
  assert.equal(rules.bookUrl, 'a@href');
  assert.equal(rules.author, '.author@text');
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --test-name-pattern 'buildDefaultSource|buildSearchCandidates|inferSearchRulesFromHtml'`

Expected: FAIL because `sourceGenerator.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `server/src/services/sourceGenerator.ts` with:

```ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getAgentForUrl } from './httpAgent';

export interface GenerateSourceInput {
  url: string;
  name?: string;
  keyword?: string;
}

export interface SearchRuleDraft {
  bookList: string;
  name: string;
  author: string;
  bookUrl: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
}

export interface SearchCandidate {
  template: string;
  url: string;
}

export interface SourceGenerationResult {
  source: any;
  jsonText: string;
  diagnostics: string[];
}

function normalizeBaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return new URL(path, `${normalizeBaseUrl(baseUrl)}/`).toString();
}

export function buildSearchCandidates(baseUrl: string, keyword: string): SearchCandidate[] {
  const encoded = encodeURIComponent(keyword);
  const templates = [
    '/search?keyword={{key}}',
    '/search.html?keyword={{key}}',
    '/search.php?keyword={{key}}',
    '/search.php?searchkey={{key}}',
    '/modules/article/search.php?searchkey={{key}}',
    '/e/search/index.php?keyboard={{key}}',
    '/plus/search.php?keyword={{key}}',
  ];
  return templates.map((template) => ({
    template,
    url: joinUrl(baseUrl, template.replace('{{key}}', encoded)),
  }));
}

export function inferSearchRulesFromHtml(html: string): SearchRuleDraft {
  const $ = cheerio.load(html);
  const candidates = [
    { selector: '.book-list li', score: $('.book-list li a[href]').length },
    { selector: '.result li', score: $('.result li a[href]').length },
    { selector: '.search-list li', score: $('.search-list li a[href]').length },
    { selector: '.grid tr', score: $('.grid tr a[href]').length },
    { selector: 'tbody tr', score: $('tbody tr a[href]').length },
    { selector: 'li', score: $('li a[href]').length },
  ].filter((item) => item.score >= 2);

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best) {
    return { bookList: 'li', name: 'a@text', author: '', bookUrl: 'a@href' };
  }

  const first = $(best.selector).first();
  const authorSelectors = ['.author', '.book-author', '.s2', 'span'].filter((selector) => first.find(selector).length > 0);

  return {
    bookList: best.selector,
    name: 'a@text',
    author: authorSelectors.length > 0 ? `${authorSelectors[0]}@text` : '',
    bookUrl: 'a@href',
    coverUrl: first.find('img').length > 0 ? 'img@src' : '',
    intro: first.find('.intro,.desc,.description').length > 0 ? '.intro@text||.desc@text||.description@text' : '',
    kind: '',
    lastChapter: '',
  };
}

export function buildDefaultSource(input: {
  url: string;
  name: string;
  searchUrl: string;
  ruleSearch: SearchRuleDraft;
}): any {
  const baseUrl = normalizeBaseUrl(input.url);
  return {
    bookSourceName: input.name,
    bookSourceType: 0,
    bookSourceUrl: baseUrl,
    customOrder: 0,
    enabled: true,
    enabledCookieJar: true,
    enabledExplore: false,
    exploreUrl: '',
    header: JSON.stringify({
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      referer: '{{baseUrl}}',
    }, null, 2),
    lastUpdateTime: Date.now(),
    respondTime: 0,
    searchUrl: input.searchUrl,
    ruleSearch: {
      bookList: input.ruleSearch.bookList,
      name: input.ruleSearch.name,
      author: input.ruleSearch.author,
      bookUrl: input.ruleSearch.bookUrl,
      coverUrl: input.ruleSearch.coverUrl || '',
      intro: input.ruleSearch.intro || '',
      kind: input.ruleSearch.kind || '',
      lastChapter: input.ruleSearch.lastChapter || '',
      wordCount: '',
    },
    ruleBookInfo: {
      name: 'h1@text||.book-title@text||.title@text',
      author: '.author@text||.book-author@text',
      intro: '#intro@text||.intro@text||.desc@text',
      kind: '.tag@text||.category@text',
      lastChapter: '.lastChapter@text||.newestChapter@text',
      coverUrl: 'img@src',
      tocUrl: '',
      wordCount: '',
    },
    ruleToc: {
      chapterList: 'dd a',
      chapterName: 'text',
      chapterUrl: 'href',
      nextTocUrl: '',
      isPay: '',
    },
    ruleContent: {
      content: '#content@html||.content@html||.chapter-content@html',
      nextContentUrl: '',
    },
    weight: 0,
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await axios.get(url, {
    timeout: 15000,
    responseType: 'text',
    httpAgent: getAgentForUrl(url),
    httpsAgent: getAgentForUrl(url),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
}

function inferNameFromHome(url: string, html: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim().replace(/[-_].*$/, '').trim();
  if (title) return title;
  return new URL(url).hostname.replace(/^www\./, '');
}

export async function generateBookSource(input: GenerateSourceInput): Promise<SourceGenerationResult> {
  const keyword = input.keyword?.trim() || '诡秘之主';
  const diagnostics: string[] = [];
  const baseUrl = normalizeBaseUrl(input.url);

  const homeHtml = await fetchText(baseUrl);
  const sourceName = inferNameFromHome(baseUrl, homeHtml, input.name);

  let selectedTemplate = '/search?keyword={{key}}';
  let ruleSearch = inferSearchRulesFromHtml('');

  for (const candidate of buildSearchCandidates(baseUrl, keyword)) {
    try {
      const html = await fetchText(candidate.url);
      const inferred = inferSearchRulesFromHtml(html);
      if (inferred.bookList !== 'li' || html.includes(keyword)) {
        selectedTemplate = candidate.template;
        ruleSearch = inferred;
        diagnostics.push(`已使用搜索候选：${candidate.template}`);
        break;
      }
    } catch (error: any) {
      diagnostics.push(`搜索候选不可用：${candidate.template}（${error.message}）`);
    }
  }

  if (ruleSearch.bookList === 'li') {
    diagnostics.push('未能稳定识别搜索结果列表，已生成基础规则草稿，需要手动调整 ruleSearch。');
  }

  const source = buildDefaultSource({
    url: baseUrl,
    name: sourceName,
    searchUrl: selectedTemplate,
    ruleSearch,
  });

  return {
    source,
    jsonText: JSON.stringify(source, null, 2),
    diagnostics,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --test-name-pattern 'buildDefaultSource|buildSearchCandidates|inferSearchRulesFromHtml'`

Expected: PASS.

## Task 2: 后端接口

**Files:**
- Modify: `server/src/controllers/sourceController.ts`
- Modify: `server/src/routes/sourceRoutes.ts`

- [ ] **Step 1: Add controller**

In `server/src/controllers/sourceController.ts`, import `generateBookSource` and add:

```ts
export async function generateSource(req: Request, res: Response): Promise<void> {
  try {
    const { url, name, keyword } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.json({ code: 400, msg: '请输入网站首页 URL' });
      return;
    }

    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.json({ code: 400, msg: '只支持 http/https 地址' });
      return;
    }

    const check = isBlockedUrl(url);
    if (check.blocked) {
      res.json({ code: 400, msg: check.reason || '该地址不允许访问' });
      return;
    }

    const result = await generateBookSource({ url, name, keyword });
    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message || '生成书源失败' });
  }
}
```

- [ ] **Step 2: Register route**

In `server/src/routes/sourceRoutes.ts`, import `generateSource` and add:

```ts
router.post('/generate', authenticateToken, requireAdmin, generateSource);
```

- [ ] **Step 3: Build server**

Run: `npm run build`

Expected: TypeScript build succeeds.

## Task 3: 前端 API

**Files:**
- Modify: `web/src/api/index.ts`

- [ ] **Step 1: Add types**

Add:

```ts
export interface GenerateSourceParams {
  url: string
  name?: string
  keyword?: string
}

export interface GenerateSourceResult {
  source: Record<string, any>
  jsonText: string
  diagnostics: string[]
}
```

- [ ] **Step 2: Add API method**

In `sourceApi`, add:

```ts
generateSource: (data: GenerateSourceParams): Promise<ApiResponse<GenerateSourceResult>> =>
  request.post('/sources/generate', data),
```

- [ ] **Step 3: Build web**

Run: `npm run build`

Expected: Vite build succeeds.

## Task 4: 前端生成弹窗

**Files:**
- Modify: `web/src/views/SourceList.vue`

- [ ] **Step 1: Add state**

Add refs:

```ts
const showGenerateDialog = ref(false)
const generatingSource = ref(false)
const generatedJson = ref('')
const generatedSource = ref<Record<string, any> | null>(null)
const generateDiagnostics = ref<string[]>([])
const generateForm = reactive({
  url: '',
  name: '',
  keyword: '诡秘之主',
})
```

- [ ] **Step 2: Add toolbar button**

Add near existing add/import buttons:

```vue
<el-button type="success" :icon="MagicStick" @click="showGenerateDialog = true">
  生成书源
</el-button>
```

- [ ] **Step 3: Add dialog template**

Add a dialog:

```vue
<el-dialog v-model="showGenerateDialog" title="生成书源" width="760px" destroy-on-close>
  <el-alert
    title="输入小说站首页后，系统会生成单个书源 JSON 草稿。生成结果可复制，也可一键导入。"
    type="info"
    :closable="false"
    show-icon
    style="margin-bottom: 16px"
  />
  <el-form :model="generateForm" label-width="100px">
    <el-form-item label="网站首页">
      <el-input v-model="generateForm.url" placeholder="http://www.xqishuta.org/" clearable />
    </el-form-item>
    <el-form-item label="书源名称">
      <el-input v-model="generateForm.name" placeholder="留空则自动读取网页标题或域名" clearable />
    </el-form-item>
    <el-form-item label="测试关键词">
      <el-input v-model="generateForm.keyword" placeholder="诡秘之主" clearable />
    </el-form-item>
  </el-form>
  <el-space style="margin-bottom: 12px">
    <el-button type="primary" :loading="generatingSource" @click="handleGenerateSource">生成</el-button>
    <el-button :disabled="!generatedJson" @click="copyGeneratedJson">复制 JSON</el-button>
    <el-button type="success" :disabled="!generatedSource" @click="importGeneratedSource">一键导入</el-button>
  </el-space>
  <el-alert
    v-if="generateDiagnostics.length"
    type="warning"
    :closable="false"
    show-icon
    style="margin-bottom: 12px"
  >
    <div v-for="item in generateDiagnostics" :key="item">{{ item }}</div>
  </el-alert>
  <el-input
    v-model="generatedJson"
    type="textarea"
    :rows="16"
    readonly
    placeholder="生成后的书源 JSON 会显示在这里"
  />
</el-dialog>
```

- [ ] **Step 4: Add methods**

Add:

```ts
const handleGenerateSource = async () => {
  if (!generateForm.url.trim()) {
    ElMessage.warning('请输入网站首页')
    return
  }
  generatingSource.value = true
  try {
    const res = await sourceApi.generateSource({
      url: generateForm.url.trim(),
      name: generateForm.name.trim() || undefined,
      keyword: generateForm.keyword.trim() || '诡秘之主',
    })
    const data = unwrapResponse(res)
    generatedSource.value = data.source
    generatedJson.value = data.jsonText
    generateDiagnostics.value = data.diagnostics || []
    ElMessage.success('书源 JSON 已生成')
  } catch (error: any) {
    ElMessage.error(error.message || '生成书源失败')
  } finally {
    generatingSource.value = false
  }
}

const copyGeneratedJson = async () => {
  if (!generatedJson.value) return
  await navigator.clipboard.writeText(generatedJson.value)
  ElMessage.success('已复制书源 JSON')
}

const importGeneratedSource = async () => {
  if (!generatedSource.value) return
  await sourceApi.addSource(generatedSource.value)
  ElMessage.success('书源已导入')
  showGenerateDialog.value = false
  fetchSources()
}
```

- [ ] **Step 5: Build web**

Run: `npm run build`

Expected: Vite build succeeds.

## Task 5: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend tests**

Run: `npm test -- --test-name-pattern 'buildDefaultSource|buildSearchCandidates|inferSearchRulesFromHtml|detectSourceCollectionUrlType'`

Expected: PASS.

- [ ] **Step 2: Build all**

Run:

```powershell
npm run build
```

in both `server` and `web`.

Expected: both builds succeed.

- [ ] **Step 3: Manual browser verification**

Open `/sources`, click `生成书源`, enter `http://www.xqishuta.org/`, click `生成`.

Expected:

- JSON preview appears.
- JSON contains `bookSourceName`, `bookSourceUrl`, `searchUrl`, `ruleSearch`, `ruleToc`, `ruleContent`.
- `复制 JSON` copies text.
- `一键导入` adds or updates one source.

- [ ] **Step 4: Regression checks**

Verify:

- `/yuedu/shuyuan/` still allowed.
- `/yuedu/shuyuans/` still allowed.
- `/yuedu/rsss/` still blocked.
- `legado.aoaostar.com/sources/` still blocked.
