# Project Hardening Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the source import API gap, harden production deployment checks, protect license secrets, add native module verification, introduce Redis-backed rate limiting with memory fallback, and establish frontend unit tests.

**Architecture:** The backend changes stay within existing Express route/controller/middleware patterns. Production validation is isolated in a new guard module, Redis shared state is isolated in a reusable client helper, and frontend tests use Vitest without changing runtime behavior.

**Tech Stack:** Express + TypeScript + MySQL + Redis on the backend; Vue 3 + Vite + Vitest + jsdom on the frontend; Node.js 20 and npm 10.

---

## File Structure

- Modify `server/src/controllers/sourceController.ts`: add reusable source import normalization and `/sources/import` handler.
- Modify `server/src/routes/source.ts`: register `POST /import`.
- Create `server/src/config/productionGuard.ts`: validate production secrets, license file, and native module readiness.
- Modify `server/src/app.ts`: call production guard before license/database startup.
- Create `server/scripts/check-native-modules.cjs`: standalone `isolated-vm` compatibility check.
- Modify `server/package.json`: add a `check:native` script.
- Create `server/src/services/redisClient.ts`: shared Redis client provider for middleware/services.
- Modify `server/src/services/searchCache.ts`: use the shared Redis client.
- Modify `server/src/middleware/rateLimit.ts`: use Redis when available, memory fallback otherwise.
- Modify `.gitignore`: explicitly ignore secret/private key paths.
- Modify `license-tools/pack-release.cjs` and `license-tools/pack-update.cjs`: scan outputs for private keys and `.secrets`.
- Modify `license-tools/README.md`: document private/public/license boundary.
- Modify `README.md`, `README_WEB.md`, `.env.docker.example`, `server/.env.example`: clarify production secret and `isolated-vm` requirements.
- Modify `web/package.json`: add Vitest dependencies and scripts.
- Modify or create `web/src/api/index.test.ts`: test `unwrapResponse`.
- Ensure `web/src/utils/seo.test.ts` runs under Vitest.

---

### Task 1: 修复 `/sources/import`

**Files:**
- Modify: `server/src/controllers/sourceController.ts`
- Modify: `server/src/routes/source.ts`
- Test: `server/src/controllers/sourceImport.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/controllers/sourceImport.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeImportPayload } from './sourceController'

test('normalizeImportPayload accepts an array of sources', () => {
  const payload = [{ bookSourceUrl: 'https://a.example', bookSourceName: 'A' }]
  assert.deepEqual(normalizeImportPayload(payload), payload)
})

test('normalizeImportPayload accepts a single source object', () => {
  const payload = { bookSourceUrl: 'https://a.example', bookSourceName: 'A' }
  assert.deepEqual(normalizeImportPayload(payload), [payload])
})

test('normalizeImportPayload accepts JSON string arrays', () => {
  const payload = '[{"bookSourceUrl":"https://a.example","bookSourceName":"A"}]'
  assert.deepEqual(normalizeImportPayload(payload), [
    { bookSourceUrl: 'https://a.example', bookSourceName: 'A' },
  ])
})

test('normalizeImportPayload rejects invalid JSON strings', () => {
  assert.throws(
    () => normalizeImportPayload('{bad json'),
    /书源导入内容不是有效 JSON/
  )
})

test('normalizeImportPayload rejects unsupported payloads', () => {
  assert.throws(
    () => normalizeImportPayload(123),
    /书源导入内容必须是对象、数组或 JSON 字符串/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/controllers/sourceImport.test.ts
```

Expected: fail because `normalizeImportPayload` is not exported.

- [ ] **Step 3: Extract normalization and import handler**

Modify `server/src/controllers/sourceController.ts`:

```ts
export function normalizeImportPayload(payload: unknown): any[] {
  let data = payload

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      throw new Error('书源导入内容不是有效 JSON')
    }
  }

  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === 'object') {
    return [data]
  }

  throw new Error('书源导入内容必须是对象、数组或 JSON 字符串')
}

async function importSourceList(sources: any[]): Promise<any[]> {
  const results: any[] = []

  await transaction(async (conn) => {
    for (const s of sources) {
      try {
        const [result] = await conn.execute(`
          INSERT INTO book_sources (
            book_source_url, book_source_name, book_source_group, book_source_type,
            book_url_pattern, custom_order, enabled, enabled_explore,
            js_lib, enabled_cookie_jar, concurrent_rate, header,
            login_url, login_ui, login_check_js, cover_decode_js,
            book_source_comment, variable_comment, explore_url, search_url,
            rule_search, rule_book_info, rule_toc, rule_content, rule_review
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            book_source_name = VALUES(book_source_name),
            book_source_group = VALUES(book_source_group),
            book_source_type = VALUES(book_source_type),
            enabled = VALUES(enabled),
            enabled_explore = VALUES(enabled_explore),
            js_lib = VALUES(js_lib),
            search_url = VALUES(search_url),
            explore_url = VALUES(explore_url),
            header = VALUES(header),
            rule_search = VALUES(rule_search),
            rule_book_info = VALUES(rule_book_info),
            rule_toc = VALUES(rule_toc),
            rule_content = VALUES(rule_content),
            rule_review = VALUES(rule_review)
        `, [
          s.bookSourceUrl, s.bookSourceName, s.bookSourceGroup || null,
          s.bookSourceType || 0, s.bookUrlPattern || null, s.customOrder || 0,
          s.enabled !== false ? 1 : 0, s.enabledExplore !== false ? 1 : 0,
          s.jsLib || null, s.enabledCookieJar !== false ? 1 : 0,
          s.concurrentRate || null, s.header || null,
          s.loginUrl || null, s.loginUi || null, s.loginCheckJs || null,
          s.coverDecodeJs || null, s.bookSourceComment || null,
          s.variableComment || null, s.exploreUrl || null, s.searchUrl || null,
          JSON.stringify(s.ruleSearch || {}), JSON.stringify(s.ruleBookInfo || {}),
          JSON.stringify(s.ruleToc || {}), JSON.stringify(s.ruleContent || {}),
          JSON.stringify(s.ruleReview || {}),
        ])
        results.push({ success: true, id: (result as any).insertId, name: s.bookSourceName })
      } catch (e: any) {
        results.push({ success: false, name: s.bookSourceName, error: e.message })
      }
    }
  })

  return results
}

export async function importSources(req: Request, res: Response): Promise<void> {
  try {
    const sources = normalizeImportPayload(req.body)
    if (sources.length === 0) {
      res.status(400).json({ code: 400, msg: '没有可导入的书源' })
      return
    }

    const results = await importSourceList(sources)
    const success = results.filter(r => r.success).length
    const fail = results.length - success
    res.json({
      code: 0,
      msg: `成功导入 ${success} 个书源${fail ? `，失败 ${fail} 个` : ''}`,
      data: { success, fail, results },
    })
  } catch (err: any) {
    res.status(400).json({ code: 400, msg: err.message })
  }
}
```

Then update existing `addSource` to call `normalizeImportPayload(data)` and `importSourceList(sources)` instead of duplicating insertion logic.

- [ ] **Step 4: Register route**

Modify `server/src/routes/source.ts` imports:

```ts
import {
  getSources, getSource, addSource, updateSource, deleteSources, getSourceGroups, importFromUrl,
  importSources, validateSource, validateSourcesStream,
} from '../controllers/sourceController';
```

Add route before `/:id`:

```ts
router.post('/import', importSources);
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/controllers/sourceImport.test.ts
npm test
npm run build
```

Expected: all tests and build pass.

---

### Task 2: 增加生产部署强校验

**Files:**
- Create: `server/src/config/productionGuard.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/config/productionGuard.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/config/productionGuard.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProductionConfig } from './productionGuard'

test('validateProductionConfig allows non-production defaults as warnings', () => {
  const result = validateProductionConfig({
    nodeEnv: 'development',
    jwtSecret: 'legado-web-secret-key-change-in-production',
    adminPassword: 'admin123',
    licensePath: 'missing/license.lic',
    sourceJsEnabled: false,
  })
  assert.equal(result.ok, true)
  assert.ok(result.warnings.length >= 1)
})

test('validateProductionConfig rejects default JWT_SECRET in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'CHANGE_ME_IN_PRODUCTION',
    adminPassword: 'StrongerPassword123!',
    licensePath: __filename,
    sourceJsEnabled: false,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /JWT_SECRET/)
})

test('validateProductionConfig rejects default admin password in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'a-production-secret-with-enough-length',
    adminPassword: 'admin123',
    licensePath: __filename,
    sourceJsEnabled: false,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /ADMIN_PASSWORD/)
})

test('validateProductionConfig rejects missing license in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'a-production-secret-with-enough-length',
    adminPassword: 'StrongerPassword123!',
    licensePath: 'missing/license.lic',
    sourceJsEnabled: false,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /license/)
})
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- src/config/productionGuard.test.ts
```

Expected: fail because module does not exist.

- [ ] **Step 3: Implement guard**

Create `server/src/config/productionGuard.ts`:

```ts
import fs from 'fs'
import path from 'path'

export interface ProductionConfigInput {
  nodeEnv: string
  jwtSecret: string
  adminPassword: string
  licensePath: string
  sourceJsEnabled: boolean
}

export interface ProductionConfigResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

const DEFAULT_JWT_SECRETS = new Set([
  '',
  'legado-web-secret-key',
  'legado-web-secret-key-change-in-production',
  'CHANGE_ME_IN_PRODUCTION',
])

const DEFAULT_ADMIN_PASSWORDS = new Set([
  '',
  'admin123',
  'CHANGE_ME',
  'CHANGE_ME_IN_PRODUCTION',
])

export function validateProductionConfig(input: ProductionConfigInput): ProductionConfigResult {
  const errors: string[] = []
  const warnings: string[] = []
  const isProduction = input.nodeEnv === 'production'

  if (DEFAULT_JWT_SECRETS.has(String(input.jwtSecret || '').trim())) {
    const message = 'JWT_SECRET 使用了空值或默认示例值'
    isProduction ? errors.push(message) : warnings.push(message)
  }

  if (String(input.jwtSecret || '').trim().length < 24) {
    const message = 'JWT_SECRET 长度不足，生产环境建议至少 24 个字符'
    isProduction ? errors.push(message) : warnings.push(message)
  }

  if (DEFAULT_ADMIN_PASSWORDS.has(String(input.adminPassword || '').trim())) {
    const message = 'ADMIN_PASSWORD 使用了空值或默认示例值'
    isProduction ? errors.push(message) : warnings.push(message)
  }

  if (String(input.adminPassword || '').trim().length < 10) {
    const message = 'ADMIN_PASSWORD 长度不足，生产环境建议至少 10 个字符'
    isProduction ? errors.push(message) : warnings.push(message)
  }

  if (isProduction && !fs.existsSync(input.licensePath)) {
    errors.push(`生产环境缺少 license 文件: ${input.licensePath}`)
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function assertProductionReady(config: {
  jwtSecret: string
  adminPassword: string
  licensePath?: string
  sourceJsEnabled: boolean
}): void {
  const result = validateProductionConfig({
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: config.jwtSecret,
    adminPassword: config.adminPassword,
    licensePath: config.licensePath || path.resolve(process.cwd(), 'license/license.lic'),
    sourceJsEnabled: config.sourceJsEnabled,
  })

  for (const warning of result.warnings) {
    console.warn(`[SECURITY] ${warning}`)
  }

  if (!result.ok) {
    throw new Error(`生产配置校验失败:\n${result.errors.map(e => `- ${e}`).join('\n')}`)
  }
}
```

- [ ] **Step 4: Call guard during startup**

Modify `server/src/app.ts` imports:

```ts
import { assertProductionReady } from './config/productionGuard';
```

Call at the start of `start()`:

```ts
    assertProductionReady({
      jwtSecret: config.jwt.secret,
      adminPassword: config.admin.password,
      sourceJsEnabled: config.security.enableSourceJs,
    });
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/config/productionGuard.test.ts
npm run build
```

Expected: tests and build pass.

---

### Task 3: 处理 `isolated-vm` ABI 检测

**Files:**
- Create: `server/scripts/check-native-modules.cjs`
- Modify: `server/package.json`
- Modify: `server/src/config/productionGuard.ts`
- Test: `server/src/config/productionGuard.test.ts`

- [ ] **Step 1: Add native module check helper tests**

Append to `server/src/config/productionGuard.test.ts`:

```ts
import { validateNativeModuleState } from './productionGuard'

test('validateNativeModuleState only warns when source JS is disabled', () => {
  const result = validateNativeModuleState({
    sourceJsEnabled: false,
    isolatedVmAvailable: false,
  })
  assert.equal(result.ok, true)
  assert.match(result.warnings.join('\n'), /isolated-vm/)
})

test('validateNativeModuleState fails when source JS is enabled and isolated-vm is unavailable', () => {
  const result = validateNativeModuleState({
    sourceJsEnabled: true,
    isolatedVmAvailable: false,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /npm rebuild isolated-vm/)
})
```

- [ ] **Step 2: Implement helper**

Add to `server/src/config/productionGuard.ts`:

```ts
export function validateNativeModuleState(input: {
  sourceJsEnabled: boolean
  isolatedVmAvailable: boolean
}): ProductionConfigResult {
  if (input.isolatedVmAvailable) {
    return { ok: true, errors: [], warnings: [] }
  }

  const message = 'isolated-vm 当前不可用；如切换过 Node 版本，请在 server 目录执行 npm rebuild isolated-vm'
  if (input.sourceJsEnabled) {
    return { ok: false, errors: [message], warnings: [] }
  }
  return { ok: true, errors: [], warnings: [message] }
}

function isIsolatedVmAvailable(): boolean {
  try {
    require('isolated-vm')
    return true
  } catch {
    return false
  }
}
```

Extend `assertProductionReady()` after production config validation:

```ts
  const nativeResult = validateNativeModuleState({
    sourceJsEnabled: config.sourceJsEnabled,
    isolatedVmAvailable: isIsolatedVmAvailable(),
  })

  for (const warning of nativeResult.warnings) {
    console.warn(`[Native] ${warning}`)
  }

  if (!nativeResult.ok) {
    throw new Error(`原生模块校验失败:\n${nativeResult.errors.map(e => `- ${e}`).join('\n')}`)
  }
```

- [ ] **Step 3: Add standalone script**

Create `server/scripts/check-native-modules.cjs`:

```js
const sourceJsEnabled = process.env.ENABLE_SOURCE_JS === 'true'

try {
  require('isolated-vm')
  console.log('[Native] isolated-vm 可用')
  process.exit(0)
} catch (err) {
  const message = [
    '[Native] isolated-vm 不可用',
    `原因: ${err && err.message ? err.message : String(err)}`,
    '修复: 在 server 目录执行 npm rebuild isolated-vm，或重新 npm install',
  ].join('\n')

  if (sourceJsEnabled) {
    console.error(message)
    process.exit(1)
  }

  console.warn(`${message}\n当前 ENABLE_SOURCE_JS=false，不阻塞启动。`)
  process.exit(0)
}
```

- [ ] **Step 4: Add package script**

Modify `server/package.json` scripts:

```json
"check:native": "node scripts/check-native-modules.cjs"
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/config/productionGuard.test.ts
npm run check:native
npm run build
```

Expected: tests/build pass; native script exits 0 when `ENABLE_SOURCE_JS` is not true.

---

### Task 4: 梳理 license 私钥和发布包边界

**Files:**
- Modify: `.gitignore`
- Modify: `license-tools/README.md`
- Modify: `license-tools/pack-release.cjs`
- Modify: `license-tools/pack-update.cjs`

- [ ] **Step 1: Inspect packing scripts**

Read:

```powershell
# Use file read tools or editor to inspect:
license-tools/pack-release.cjs
license-tools/pack-update.cjs
```

Expected: identify output directory paths and final copy/zip steps.

- [ ] **Step 2: Add secret ignores**

Modify root `.gitignore` and ensure these entries exist:

```gitignore
.secrets/
**/.secrets/
**/private.pem
license-tools/out/**/*.key
license-tools/out/**/private*
```

- [ ] **Step 3: Add private key scanner to pack scripts**

Add this helper to both `license-tools/pack-release.cjs` and `license-tools/pack-update.cjs`:

```js
function assertNoPrivateSecrets(dir) {
  const offenders = []

  function walk(current) {
    if (!fs.existsSync(current)) return
    const stat = fs.statSync(current)
    if (stat.isDirectory()) {
      if (path.basename(current) === '.secrets') {
        offenders.push(current)
        return
      }
      for (const name of fs.readdirSync(current)) {
        walk(path.join(current, name))
      }
      return
    }

    const base = path.basename(current).toLowerCase()
    if (base === 'private.pem' || base.includes('private')) {
      offenders.push(current)
    }
  }

  walk(dir)

  if (offenders.length > 0) {
    throw new Error(`发布产物包含私钥或 secrets 目录，已拒绝打包:\n${offenders.join('\n')}`)
  }
}
```

Call it immediately before zip/archive output is finalized, passing the staging/output directory.

- [ ] **Step 4: Update license documentation**

Add to `license-tools/README.md`:

```md
## 私钥和交付边界

- `.secrets/` 和 `private.pem` 只允许存在于供应商签发环境。
- 客户交付包、更新包、Docker 镜像和 `release/` 目录不得包含私钥。
- 客户环境只需要 `license.lic` 和 `public.pem`。
- 如果打包脚本发现 `.secrets` 或 `private.pem`，会拒绝继续生成交付产物。
```

- [ ] **Step 5: Verify**

Run the relevant pack script that is safe for the local environment:

```powershell
node license-tools/pack-release.cjs
```

Expected: if no private key is copied into output, script succeeds; if private key appears in staging, it fails with a clear message.

---

### Task 5: Redis 优先限流

**Files:**
- Create: `server/src/services/redisClient.ts`
- Modify: `server/src/services/searchCache.ts`
- Modify: `server/src/middleware/rateLimit.ts`
- Test: `server/src/middleware/rateLimit.test.ts`

- [ ] **Step 1: Write middleware tests using fake Redis**

Create `server/src/middleware/rateLimit.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from './rateLimit'

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
  return res
}

test('createRateLimiter limits using Redis when Redis is available', async () => {
  const counts = new Map<string, number>()
  const redis: any = {
    async incr(key: string) {
      const next = (counts.get(key) || 0) + 1
      counts.set(key, next)
      return next
    },
    async expire() {
      return 1
    },
  }
  const limiter = createRateLimiter(60000, 1, async () => redis)

  let nextCount = 0
  const req: any = { ip: '1.2.3.4', socket: {} }
  await limiter(req, mockRes(), () => { nextCount++ })

  const res = mockRes()
  await limiter(req, res, () => { nextCount++ })

  assert.equal(nextCount, 1)
  assert.equal(res.statusCode, 429)
})

test('createRateLimiter falls back to memory when Redis is unavailable', async () => {
  const limiter = createRateLimiter(60000, 1, async () => null)

  let nextCount = 0
  const req: any = { ip: '5.6.7.8', socket: {} }
  await limiter(req, mockRes(), () => { nextCount++ })

  const res = mockRes()
  await limiter(req, res, () => { nextCount++ })

  assert.equal(nextCount, 1)
  assert.equal(res.statusCode, 429)
})
```

- [ ] **Step 2: Implement shared Redis client**

Create `server/src/services/redisClient.ts`:

```ts
import { createClient, type RedisClientType } from 'redis'
import { config } from '../config'

let redisClient: RedisClientType | null = null
let redisConnecting: Promise<RedisClientType | null> | null = null

export async function getSharedRedisClient(): Promise<RedisClientType | null> {
  if (!config.redis.enabled) return null
  if (redisClient?.isOpen) return redisClient
  if (redisConnecting) return redisConnecting

  redisConnecting = (async () => {
    try {
      const client = createClient({
        url: config.redis.url,
        socket: {
          connectTimeout: config.redis.connectTimeout,
          reconnectStrategy: false,
        },
      })
      client.on('error', (err) => {
        console.warn('[Redis] 连接异常:', err.message)
      })
      await client.connect()
      redisClient = client as RedisClientType
      console.log('[Redis] 已连接')
      return redisClient
    } catch (err: any) {
      console.warn('[Redis] 不可用，相关功能将降级:', err?.message || err)
      redisClient = null
      return null
    } finally {
      redisConnecting = null
    }
  })()

  return redisConnecting
}

export async function closeSharedRedisClient(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit()
  }
  redisClient = null
  redisConnecting = null
}
```

- [ ] **Step 3: Update search cache**

Modify `server/src/services/searchCache.ts`:

```ts
import { getSharedRedisClient, closeSharedRedisClient } from './redisClient'
```

Replace its private `getRedisClient()` implementation with:

```ts
async function getRedisClient(): Promise<RedisClientType | null> {
  return getSharedRedisClient()
}
```

Update `closeRedis()`:

```ts
export async function closeRedis(): Promise<void> {
  await closeSharedRedisClient()
}
```

- [ ] **Step 4: Update rate limiter**

Modify `server/src/middleware/rateLimit.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import { getSharedRedisClient } from '../services/redisClient'

interface RateLimitEntry {
  count: number
  resetTime: number
}

type RedisProvider = () => Promise<any | null>

const ipStore = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of ipStore.entries()) {
    if (entry.resetTime < now) {
      ipStore.delete(ip)
    }
  }
}, 60000)

function memoryLimit(ip: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now()
  const entry = ipStore.get(ip)

  if (!entry || entry.resetTime < now) {
    ipStore.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  redisProvider: RedisProvider = getSharedRedisClient
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'

    try {
      const redis = await redisProvider()
      if (redis) {
        const key = `legado:ratelimit:${windowMs}:${ip}`
        const count = await redis.incr(key)
        if (count === 1) {
          await redis.expire(key, Math.ceil(windowMs / 1000))
        }
        if (count > maxRequests) {
          res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试' })
          return
        }
        next()
        return
      }
    } catch (err: any) {
      console.warn('[RateLimit] Redis 限流不可用，降级为内存限流:', err?.message || err)
    }

    if (!memoryLimit(ip, windowMs, maxRequests)) {
      res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试' })
      return
    }

    next()
  }
}

export function rateLimit(windowMs: number, maxRequests: number) {
  return createRateLimiter(windowMs, maxRequests)
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/middleware/rateLimit.test.ts
npm test
npm run build
```

Expected: tests and build pass.

---

### Task 6: 前端基础测试体系

**Files:**
- Modify: `web/package.json`
- Modify: `web/src/utils/seo.test.ts` if needed
- Create: `web/src/api/index.test.ts`

- [ ] **Step 1: Install test dependencies**

Run:

```powershell
npm install -D vitest jsdom @vue/test-utils
```

Expected: `web/package.json` and `web/package-lock.json` updated.

- [ ] **Step 2: Add test scripts**

Modify `web/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add API utility test**

Create `web/src/api/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { unwrapResponse } from './index'

describe('unwrapResponse', () => {
  it('returns data for standard ApiResponse objects', () => {
    expect(unwrapResponse({ code: 0, data: { ok: true } })).toEqual({ ok: true })
  })

  it('returns non-standard values unchanged', () => {
    expect(unwrapResponse(['a', 'b'])).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 4: Ensure existing SEO test is Vitest-compatible**

If `web/src/utils/seo.test.ts` imports `node:test`, replace it with:

```ts
import { describe, expect, it } from 'vitest'
```

Use `expect(actual).toBe(expected)` or `expect(actual).toEqual(expected)` assertions.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test
npm run build
```

Expected: frontend tests and build pass.

---

### Task 7: 文档和环境示例更新

**Files:**
- Modify: `README.md`
- Modify: `README_WEB.md`
- Modify: `.env.docker.example`
- Modify: `server/.env.example`

- [ ] **Step 1: Update README native module guidance**

In both `README.md` and `README_WEB.md`, ensure this section exists near runtime requirements:

```md
如果切换过 Node 版本，或生产环境启用了 `ENABLE_SOURCE_JS=true`，请在 `server` 目录执行：

```powershell
npm rebuild isolated-vm
npm run check:native
```

默认 `ENABLE_SOURCE_JS=false`，书源内联 JS 不执行，此时 `isolated-vm` 不可用不会阻塞开发启动。
```

- [ ] **Step 2: Update production secret guidance**

In `README.md`, add:

```md
生产环境会拒绝使用默认 `JWT_SECRET`、默认 `ADMIN_PASSWORD` 或缺失 license 文件启动。部署前必须修改 `.env` 或 Docker 环境变量中的密钥和管理员密码。
```

- [ ] **Step 3: Update env examples**

In `.env.docker.example`, ensure placeholders are explicit:

```env
JWT_SECRET=CHANGE_ME_IN_PRODUCTION
ADMIN_PASSWORD=CHANGE_ME
```

In `server/.env.example`, keep development defaults but add comments:

```env
# 生产环境必须替换，不能使用默认值
JWT_SECRET=legado-web-secret-key-change-in-production

# 生产环境必须替换，不能使用 admin123
ADMIN_PASSWORD=admin123
```

- [ ] **Step 4: Verify docs are readable**

Run:

```powershell
npm run build
```

Expected: docs changes do not affect backend build.

---

### Task 8: 总体验证

**Files:**
- All modified files

- [ ] **Step 1: Backend full test**

Run:

```powershell
npm test
```

Expected: all backend tests pass.

- [ ] **Step 2: Backend build**

Run:

```powershell
npm run build
```

Expected: TypeScript build passes.

- [ ] **Step 3: Frontend test**

Run in `web`:

```powershell
npm test
```

Expected: all frontend tests pass.

- [ ] **Step 4: Frontend build**

Run in `web`:

```powershell
npm run build
```

Expected: Vite build passes.

- [ ] **Step 5: Production guard smoke test**

Run in `server`:

```powershell
$env:NODE_ENV='production'; $env:JWT_SECRET='CHANGE_ME_IN_PRODUCTION'; $env:ADMIN_PASSWORD='admin123'; npm run build
```

Expected: build passes because guard is runtime startup logic, not build logic.

Then run startup only if a valid license exists and ports are safe:

```powershell
$env:NODE_ENV='production'; $env:JWT_SECRET='CHANGE_ME_IN_PRODUCTION'; $env:ADMIN_PASSWORD='admin123'; node dist/app.js
```

Expected: startup fails before listening with production config validation error.

- [ ] **Step 6: Release boundary scan**

Run safe pack script:

```powershell
node license-tools/pack-release.cjs
```

Expected: generated release output contains no `.secrets` or `private.pem`; script fails if either appears.

