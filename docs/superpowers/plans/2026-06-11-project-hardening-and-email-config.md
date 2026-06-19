# Project Hardening and Email Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the test/runtime baseline, harden security-sensitive flows, and add admin email configuration with SMTP password reset delivery.

**Architecture:** Implement in phases: first restore a reliable Node 20/test baseline, then add repository boundaries for configuration and auth, then wire email delivery and cookie auth, then split the admin site configuration UI. Keep existing APIs compatible while adding safer defaults.

**Tech Stack:** Node.js 20 LTS, Express, TypeScript, MySQL, Redis, Vue 3, Vite, Element Plus, Pinia, Nodemailer.

---

## File Structure

Create or modify these files:

- Create: `.nvmrc` to lock Node 20.
- Modify: `README.md`, `README_WEB.md`, `server/package.json`, `web/package.json` for engines and dependency guidance.
- Modify: `server/src/services/sourceAvailability.test.ts` to align with the 10-chapter rule.
- Create: `server/src/repositories/siteConfigRepository.ts` for site config data access.
- Create: `server/src/repositories/userRepository.ts` for user and password reset data access.
- Create: `server/src/services/emailConfig.ts` for safe email config parsing and masking.
- Create: `server/src/services/emailService.ts` for SMTP delivery and test email.
- Create: `server/src/services/emailService.test.ts` for config parsing and missing SMTP behavior.
- Modify: `server/src/controllers/siteConfigController.ts` to use repositories and add email test.
- Modify: `server/src/controllers/authController.ts` to use repositories, SMTP password reset, and httpOnly cookies.
- Modify: `server/src/routes/auth.ts` to add logout.
- Modify: `server/src/routes/siteConfig.ts` to add email test route.
- Modify: `server/src/migrations/009_password_reset_tokens.ts` comments to reflect real SMTP delivery.
- Create: `server/src/migrations/010_email_config_defaults.ts` for email config defaults.
- Modify: `server/src/config/migrations.ts` to include migration 010.
- Modify: `web/src/api/index.ts` to update forgot-password return type and add email test API.
- Create: `web/src/views/admin/site-config/BasicConfig.vue` by moving current basic config form.
- Create: `web/src/views/admin/site-config/EmailConfig.vue` for SMTP/POP3/IMAP config.
- Modify: `web/src/router/index.ts` to add `/admin/site-config/basic` and `/admin/site-config/email`.
- Modify: `web/src/views/admin/AdminLayout.vue` to show the two site config submenus.
- Modify: `.gitignore` to ignore `.secrets/`.
- Modify: `license-tools/generate-license.cjs`, `license-tools/sign-file.cjs`, `license-tools/pack-release.cjs`, `license-tools/README.md`, and `license-tools/UPDATE-GUIDE.md` to use env private key path and document key isolation.

## Task 1: Node 20 and Test Baseline

**Files:**
- Create: `.nvmrc`
- Modify: `server/package.json`
- Modify: `web/package.json`
- Modify: `README.md`
- Modify: `README_WEB.md`
- Modify: `server/src/services/sourceAvailability.test.ts`

- [ ] **Step 1: Write the Node version file**

Create `.nvmrc` with:

```text
20
```

- [ ] **Step 2: Add engine constraints**

In `server/package.json` and `web/package.json`, add this top-level field after `version`:

```json
"engines": {
  "node": ">=20 <21",
  "npm": ">=10"
}
```

Do not remove existing scripts or dependencies.

- [ ] **Step 3: Document Node 20**

In `README.md` and `README_WEB.md`, add this before local startup instructions:

```markdown
## 运行环境

- Node.js：20 LTS
- npm：10+

如果切换过 Node 版本，请在 `server` 目录重新安装依赖或执行：

```powershell
npm rebuild isolated-vm
```
```

- [ ] **Step 4: Fix source availability test**

Replace the first test in `server/src/services/sourceAvailability.test.ts` with a 10-chapter fixture:

```ts
test('目录返回至少 10 个有效章节时视为可显示', async () => {
  const engine = {
    async getChapterList() {
      return Array.from({ length: 10 }, (_, index) => ({
        index,
        title: `第${index + 1}章`,
        url: `https://example.com/${index + 1}`,
      }));
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 1000);

  assert.equal(ok, true);
});
```

Replace the second test name with:

```ts
test('目录不足 10 章时跳过该书源（2 章不展示）', async () => {
```

- [ ] **Step 5: Run focused test**

Run:

```powershell
npm test -- src/services/sourceAvailability.test.ts
```

Expected: source availability tests pass. If `isolated-vm` still fails because the full test runner loads other tests, continue to Step 6.

- [ ] **Step 6: Rebuild native dependency**

Run in `server`:

```powershell
npm rebuild isolated-vm
```

Expected: command exits with code 0 under Node 20.

- [ ] **Step 7: Run full backend test**

Run:

```powershell
npm test
```

Expected: all backend tests pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add .nvmrc README.md README_WEB.md server/package.json web/package.json server/src/services/sourceAvailability.test.ts
git commit -m "chore: lock node 20 and restore test baseline"
```

If `git` is unavailable in this environment, record the skipped commit in the final implementation notes.

## Task 2: Config and User Repositories

**Files:**
- Create: `server/src/repositories/siteConfigRepository.ts`
- Create: `server/src/repositories/userRepository.ts`
- Modify: `server/src/controllers/siteConfigController.ts`
- Modify: `server/src/controllers/authController.ts`

- [ ] **Step 1: Add site config repository test by using existing controller behavior**

No new controller test harness exists. Use TypeScript build as the regression gate for this repository and keep the API response shape unchanged.

- [ ] **Step 2: Create site config repository**

Create `server/src/repositories/siteConfigRepository.ts`:

```ts
import { execute, query, queryOne, transaction } from '../config/database';

export interface SiteConfigItem {
  id?: number;
  config_key: string;
  config_value: string;
  description?: string;
}

export async function getAllSiteConfigs(): Promise<SiteConfigItem[]> {
  return query('SELECT id, config_key, config_value, description FROM site_config ORDER BY id');
}

export async function getSiteConfigByKey(key: string): Promise<SiteConfigItem | null> {
  return queryOne('SELECT config_key, config_value FROM site_config WHERE config_key = ?', [key]);
}

export async function upsertSiteConfig(config_key: string, config_value: string): Promise<void> {
  await execute(`
    INSERT INTO site_config (config_key, config_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
  `, [config_key, config_value]);
}

export async function upsertSiteConfigs(configs: Array<{ config_key: string; config_value: string }>): Promise<void> {
  await transaction(async (conn) => {
    for (const item of configs) {
      await conn.execute(`
        INSERT INTO site_config (config_key, config_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
      `, [item.config_key, item.config_value]);
    }
  });
}
```

- [ ] **Step 3: Create user repository**

Create `server/src/repositories/userRepository.ts`:

```ts
import { execute, query, queryOne, transaction } from '../config/database';

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string;
  role: string;
  is_active: number;
  created_at?: string;
}

export interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  expires_at: Date | string;
  used_at: Date | string | null;
}

export async function findUserByUsernameOrEmail(usernameOrEmail: string): Promise<UserRow | null> {
  return queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [usernameOrEmail, usernameOrEmail]);
}

export async function findUserIdByUsernameOrEmail(username: string, email: string): Promise<{ id: number } | null> {
  return queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
}

export async function findUserByEmail(email: string): Promise<Pick<UserRow, 'id' | 'username' | 'email'> | null> {
  return queryOne('SELECT id, username, email FROM users WHERE email = ?', [email]);
}

export async function findPublicUserById(id: number): Promise<Omit<UserRow, 'password_hash' | 'is_active'> | null> {
  return queryOne('SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id = ?', [id]);
}

export async function createUser(username: string, email: string, passwordHash: string): Promise<number> {
  const result = await execute(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, passwordHash]
  );
  return result.insertId;
}

export async function updateUserProfile(userId: number, email?: string, avatarUrl?: string): Promise<void> {
  await execute(
    'UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?',
    [email ?? null, avatarUrl ?? null, userId]
  );
}

export async function findOtherUserByEmail(email: string, userId: number): Promise<{ id: number } | null> {
  return queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
}

export async function getPasswordHash(userId: number): Promise<{ password_hash: string } | null> {
  return queryOne('SELECT password_hash FROM users WHERE id = ?', [userId]);
}

export async function updatePassword(userId: number, passwordHash: string): Promise<void> {
  await execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
}

export async function createPasswordResetToken(userId: number, email: string, token: string, expiresAt: Date): Promise<void> {
  await execute(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [userId]
  );
  await execute(
    'INSERT INTO password_reset_tokens (user_id, email, token, expires_at) VALUES (?, ?, ?, ?)',
    [userId, email, token, expiresAt]
  );
}

export async function resetPasswordWithToken(email: string, token: string, passwordHash: string): Promise<'not_found' | 'used' | 'expired' | 'ok'> {
  return transaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE email = ? AND token = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, token]
    );
    const record = (rows as PasswordResetTokenRow[])[0];
    if (!record) return 'not_found';
    if (record.used_at) return 'used';
    if (new Date(record.expires_at).getTime() < Date.now()) return 'expired';

    await conn.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, record.user_id]);
    await conn.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [record.id]);
    return 'ok';
  });
}

export async function countUserBooks(userId: number): Promise<number> {
  const row = await queryOne('SELECT COUNT(*) as count FROM user_books WHERE user_id = ?', [userId]);
  return row?.count || 0;
}
```

- [ ] **Step 4: Update site config controller imports and calls**

In `server/src/controllers/siteConfigController.ts`, replace direct DB imports with:

```ts
import { Request, Response } from 'express';
import {
  getAllSiteConfigs,
  getSiteConfigByKey,
  upsertSiteConfig,
  upsertSiteConfigs,
} from '../repositories/siteConfigRepository';
```

Then replace controller internals:

```ts
const items = await getAllSiteConfigs();
const item = await getSiteConfigByKey(key);
await upsertSiteConfig(config_key, config_value);
await upsertSiteConfigs(configs);
```

- [ ] **Step 5: Update auth controller gradually**

In `server/src/controllers/authController.ts`, replace DB helper imports with repository functions:

```ts
import {
  countUserBooks,
  createPasswordResetToken,
  createUser,
  findOtherUserByEmail,
  findPublicUserById,
  findUserByEmail,
  findUserByUsernameOrEmail,
  findUserIdByUsernameOrEmail,
  getPasswordHash,
  resetPasswordWithToken,
  updatePassword,
  updateUserProfile as updateUserProfileRow,
} from '../repositories/userRepository';
```

Use these substitutions:

```ts
const existing = await findUserIdByUsernameOrEmail(username, email);
const userId = await createUser(username, email, passwordHash);
const user = await findUserByUsernameOrEmail(username);
const userInfo = await findPublicUserById(user.userId);
const shelfCount = await countUserBooks(user.userId);
const existing = await findOtherUserByEmail(email, user.userId);
await updateUserProfileRow(user.userId, email, avatar_url);
const userInfo = await getPasswordHash(user.userId);
await updatePassword(user.userId, hash);
const user = await findUserByEmail(email);
await createPasswordResetToken(user.id, email, token, expiresAt);
const resetResult = await resetPasswordWithToken(email, token, hash);
```

Map reset results:

```ts
if (resetResult === 'not_found') {
  res.json({ code: 400, msg: '验证码无效' });
  return;
}
if (resetResult === 'used') {
  res.json({ code: 400, msg: '验证码已使用' });
  return;
}
if (resetResult === 'expired') {
  res.json({ code: 400, msg: '验证码已过期' });
  return;
}
```

- [ ] **Step 6: Build backend**

Run:

```powershell
npm run build
```

Expected: TypeScript build passes.

- [ ] **Step 7: Commit**

Run:

```powershell
git add server/src/repositories server/src/controllers/siteConfigController.ts server/src/controllers/authController.ts
git commit -m "refactor: move config and auth queries to repositories"
```

## Task 3: Email Config, SMTP Delivery, and Password Reset

**Files:**
- Create: `server/src/services/emailConfig.ts`
- Create: `server/src/services/emailService.ts`
- Create: `server/src/services/emailService.test.ts`
- Modify: `server/package.json`
- Modify: `server/src/controllers/siteConfigController.ts`
- Modify: `server/src/controllers/authController.ts`
- Modify: `server/src/routes/siteConfig.ts`
- Create: `server/src/migrations/010_email_config_defaults.ts`
- Modify: `server/src/config/migrations.ts`

- [ ] **Step 1: Add dependency**

Run in `server`:

```powershell
npm install nodemailer
npm install -D @types/nodemailer
```

Expected: `package.json` and `package-lock.json` include nodemailer.

- [ ] **Step 2: Create email config service**

Create `server/src/services/emailConfig.ts`:

```ts
export interface EmailConfig {
  email_enabled: boolean;
  email_from_name: string;
  email_from_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  pop3_host: string;
  pop3_port: number;
  pop3_secure: boolean;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
}

export const EMAIL_CONFIG_KEYS = [
  'email_enabled',
  'email_from_name',
  'email_from_address',
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_username',
  'smtp_password',
  'pop3_host',
  'pop3_port',
  'pop3_secure',
  'imap_host',
  'imap_port',
  'imap_secure',
] as const;

export function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

export function parsePort(value: unknown, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

export function buildEmailConfig(map: Record<string, string | undefined>): EmailConfig {
  return {
    email_enabled: parseBool(map.email_enabled),
    email_from_name: map.email_from_name || '',
    email_from_address: map.email_from_address || '',
    smtp_host: map.smtp_host || '',
    smtp_port: parsePort(map.smtp_port, 465),
    smtp_secure: parseBool(map.smtp_secure),
    smtp_username: map.smtp_username || '',
    smtp_password: map.smtp_password || '',
    pop3_host: map.pop3_host || '',
    pop3_port: parsePort(map.pop3_port, 995),
    pop3_secure: parseBool(map.pop3_secure),
    imap_host: map.imap_host || '',
    imap_port: parsePort(map.imap_port, 993),
    imap_secure: parseBool(map.imap_secure),
  };
}

export function maskEmailConfig(items: Array<{ config_key: string; config_value: string; [key: string]: any }>) {
  return items.map((item) => {
    if (item.config_key === 'smtp_password' && item.config_value) {
      return { ...item, config_value: '__CONFIGURED__' };
    }
    return item;
  });
}

export function isEmailConfigComplete(config: EmailConfig): boolean {
  return Boolean(
    config.email_enabled &&
    config.email_from_address &&
    config.smtp_host &&
    config.smtp_port &&
    config.smtp_username &&
    config.smtp_password
  );
}
```

- [ ] **Step 3: Create email service**

Create `server/src/services/emailService.ts`:

```ts
import nodemailer from 'nodemailer';
import { getAllSiteConfigs } from '../repositories/siteConfigRepository';
import { buildEmailConfig, isEmailConfigComplete } from './emailConfig';

async function loadEmailConfig() {
  const configs = await getAllSiteConfigs();
  const map = configs.reduce<Record<string, string>>((acc, item) => {
    acc[item.config_key] = item.config_value || '';
    return acc;
  }, {});
  return buildEmailConfig(map);
}

export async function sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const config = await loadEmailConfig();
  if (!isEmailConfigComplete(config)) {
    throw new Error('邮箱 SMTP 配置不完整或未启用');
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_secure,
    auth: {
      user: config.smtp_username,
      pass: config.smtp_password,
    },
  });

  await transporter.sendMail({
    from: {
      name: config.email_from_name || config.email_from_address,
      address: config.email_from_address,
    },
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

export async function sendPasswordResetCode(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: '密码重置验证码',
    text: `您的密码重置验证码是：${code}，15 分钟内有效。若非本人操作，请忽略此邮件。`,
    html: `<p>您的密码重置验证码是：</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>15 分钟内有效。若非本人操作，请忽略此邮件。</p>`,
  });
}

export async function sendTestEmail(to: string): Promise<void> {
  await sendMail({
    to,
    subject: '邮箱配置测试',
    text: '这是一封邮箱配置测试邮件。收到此邮件说明 SMTP 配置可用。',
  });
}
```

- [ ] **Step 4: Write email config tests**

Create `server/src/services/emailService.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmailConfig, isEmailConfigComplete, maskEmailConfig } from './emailConfig';

test('buildEmailConfig parses booleans and ports with defaults', () => {
  const config = buildEmailConfig({
    email_enabled: 'true',
    smtp_port: '465',
    smtp_secure: 'true',
    pop3_port: '995',
    imap_port: '993',
  });

  assert.equal(config.email_enabled, true);
  assert.equal(config.smtp_port, 465);
  assert.equal(config.smtp_secure, true);
  assert.equal(config.pop3_port, 995);
  assert.equal(config.imap_port, 993);
});

test('isEmailConfigComplete requires enabled SMTP credentials', () => {
  assert.equal(isEmailConfigComplete(buildEmailConfig({ email_enabled: 'false' })), false);
  assert.equal(isEmailConfigComplete(buildEmailConfig({
    email_enabled: 'true',
    email_from_address: 'noreply@example.com',
    smtp_host: 'smtp.example.com',
    smtp_port: '465',
    smtp_username: 'noreply@example.com',
    smtp_password: 'secret',
  })), true);
});

test('maskEmailConfig hides configured smtp password', () => {
  const result = maskEmailConfig([
    { config_key: 'smtp_password', config_value: 'secret' },
    { config_key: 'smtp_host', config_value: 'smtp.example.com' },
  ]);

  assert.equal(result[0].config_value, '__CONFIGURED__');
  assert.equal(result[1].config_value, 'smtp.example.com');
});
```

- [ ] **Step 5: Add email config migration**

Create `server/src/migrations/010_email_config_defaults.ts`:

```ts
import type mysql from 'mysql2/promise';

export const name = '010_email_config_defaults';

const defaults = [
  ['email_enabled', 'false', '是否启用邮件发送'],
  ['email_from_name', '', '邮件发件人名称'],
  ['email_from_address', '', '邮件发件人地址'],
  ['smtp_host', '', 'SMTP 主机'],
  ['smtp_port', '465', 'SMTP 端口'],
  ['smtp_secure', 'true', 'SMTP 是否使用 SSL/TLS'],
  ['smtp_username', '', 'SMTP 用户名'],
  ['smtp_password', '', 'SMTP 密码'],
  ['pop3_host', '', 'POP3 主机'],
  ['pop3_port', '995', 'POP3 端口'],
  ['pop3_secure', 'true', 'POP3 是否使用 SSL/TLS'],
  ['imap_host', '', 'IMAP 主机'],
  ['imap_port', '993', 'IMAP 端口'],
  ['imap_secure', 'true', 'IMAP 是否使用 SSL/TLS'],
] as const;

export async function up(db: mysql.Pool): Promise<void> {
  for (const [key, value, description] of defaults) {
    await db.query(
      `INSERT INTO site_config (config_key, config_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [key, value, description]
    );
  }
}
```

Modify `server/src/config/migrations.ts`:

```ts
import * as emailConfigDefaults from '../migrations/010_email_config_defaults';
```

Add to the end of `migrations`:

```ts
emailConfigDefaults,
```

- [ ] **Step 6: Add email test endpoint**

In `server/src/controllers/siteConfigController.ts`, import:

```ts
import { sendTestEmail } from '../services/emailService';
import { maskEmailConfig } from '../services/emailConfig';
```

Mask passwords in `getAllConfigs` before returning:

```ts
res.json({ code: 0, data: maskEmailConfig(items) });
```

Preserve old password when receiving `__CONFIGURED__`:

```ts
const normalizedConfigs = [];
for (const item of configs) {
  if (item.config_key === 'smtp_password' && item.config_value === '__CONFIGURED__') {
    continue;
  }
  normalizedConfigs.push(item);
}
await upsertSiteConfigs(normalizedConfigs);
```

Add controller:

```ts
export async function testEmailConfig(req: Request, res: Response): Promise<void> {
  try {
    const { to } = req.body;
    if (!to) {
      res.json({ code: 400, msg: '请输入测试收件邮箱' });
      return;
    }
    await sendTestEmail(String(to));
    res.json({ code: 0, msg: '测试邮件发送成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message || '测试邮件发送失败' });
  }
}
```

In `server/src/routes/siteConfig.ts`, import `testEmailConfig` and add after protected routes:

```ts
router.post('/email/test', testEmailConfig);
```

- [ ] **Step 7: Send reset code by SMTP**

In `server/src/controllers/authController.ts`, import:

```ts
import { sendPasswordResetCode } from '../services/emailService';
```

In `forgotPassword`, after `createPasswordResetToken(...)`, call:

```ts
await sendPasswordResetCode(email, token);
```

Replace the response data with:

```ts
res.json({
  code: 0,
  msg: '验证码已发送，请检查邮箱',
  data: {
    email,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: 15 * 60,
  },
});
```

Do not return `token` or `hint`.

- [ ] **Step 8: Run tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add server/package.json server/package-lock.json server/src/services/emailConfig.ts server/src/services/emailService.ts server/src/services/emailService.test.ts server/src/controllers/siteConfigController.ts server/src/controllers/authController.ts server/src/routes/siteConfig.ts server/src/migrations/010_email_config_defaults.ts server/src/config/migrations.ts
git commit -m "feat: add smtp email configuration and password reset delivery"
```

## Task 4: Cookie Auth Compatibility

**Files:**
- Modify: `server/src/controllers/authController.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `web/src/api/index.ts`
- Modify: `web/src/store/auth.ts`

- [ ] **Step 1: Add cookie helpers**

In `server/src/controllers/authController.ts`, add:

```ts
function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('token', { path: '/' });
  res.json({ code: 0, msg: '已退出登录' });
}
```

After token generation in `register` and `login`, call:

```ts
setAuthCookie(res, token);
```

- [ ] **Step 2: Add logout route**

In `server/src/routes/auth.ts`, import `logout` and add:

```ts
router.post('/logout', logout);
```

- [ ] **Step 3: Enable credentialed requests**

In `web/src/api/index.ts`, add `withCredentials: true` to the axios instance:

```ts
const request: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

Add API method:

```ts
logout() {
  return request.post<any, void>('/auth/logout')
},
```

- [ ] **Step 4: Call logout endpoint from store**

In `web/src/store/auth.ts`, update logout:

```ts
async function logout() {
  try {
    await authApi.logout()
  } catch {
    // 即使服务端清理失败，也清理本地状态
  }
  token.value = ''
  user.value = null
  localStorage.removeItem('token')
}
```

If any existing caller expects sync logout, keep a second helper:

```ts
function clearLocalAuth() {
  token.value = ''
  user.value = null
  localStorage.removeItem('token')
}
```

Use `clearLocalAuth()` inside catch paths that cannot await.

- [ ] **Step 5: Build**

Run:

```powershell
npm run build
```

Expected: both server and web build after running in their respective directories.

- [ ] **Step 6: Commit**

Run:

```powershell
git add server/src/controllers/authController.ts server/src/routes/auth.ts web/src/api/index.ts web/src/store/auth.ts
git commit -m "feat: support httpOnly auth cookie"
```

## Task 5: Admin Site Config UI Split

**Files:**
- Create: `web/src/views/admin/site-config/BasicConfig.vue`
- Create: `web/src/views/admin/site-config/EmailConfig.vue`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/views/admin/AdminLayout.vue`
- Modify: `web/src/api/index.ts`

- [ ] **Step 1: Move basic config page**

Create `web/src/views/admin/site-config/BasicConfig.vue` by copying the current contents of `web/src/views/admin/SiteConfig.vue`.

In the copied file, change visible labels:

```vue
<span>基础配置</span>
```

Keep these config keys:

```ts
const defaultForm = {
  site_title: '',
  site_subtitle: '',
  site_logo: '',
  default_book_cover: '',
  web_domain: '',
  wap_domain: '',
  icp_number: '',
  analytics_code: '',
  copyright: '',
  home_title: '',
  home_keywords: '',
  home_description: '',
}
```

- [ ] **Step 2: Add email API types**

In `web/src/api/index.ts`, add:

```ts
export interface SiteConfigItem {
  id: number;
  config_key: string;
  config_value: string;
  description: string;
}
```

Change config API return types to use `SiteConfigItem[]`.

Add:

```ts
testEmail(data: { to: string }) {
  return request.post<any, void>('/config/email/test', data)
},
```

Update forgot password return type:

```ts
forgotPassword(data: { email: string }) {
  return request.post<any, { email: string; expiresAt: string; expiresInSeconds: number }>(
    '/auth/forgot-password',
    data
  )
},
```

- [ ] **Step 3: Create email config page**

Create `web/src/views/admin/site-config/EmailConfig.vue`:

```vue
<template>
  <div class="email-config-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>邮箱配置</span>
        </div>
      </template>

      <el-form :model="form" label-width="140px" class="email-config-form">
        <el-divider content-position="left">发送设置</el-divider>
        <el-form-item label="启用邮件发送">
          <el-switch v-model="form.email_enabled" active-value="true" inactive-value="false" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="发件人名称">
            <el-input v-model="form.email_from_name" placeholder="例如：Legado Home" />
          </el-form-item>
          <el-form-item label="发件人邮箱">
            <el-input v-model="form.email_from_address" placeholder="例如：noreply@example.com" />
          </el-form-item>
        </div>

        <el-divider content-position="left">SMTP</el-divider>
        <div class="form-grid">
          <el-form-item label="SMTP 主机">
            <el-input v-model="form.smtp_host" placeholder="例如：smtp.example.com" />
          </el-form-item>
          <el-form-item label="SMTP 端口">
            <el-input v-model="form.smtp_port" placeholder="465" />
          </el-form-item>
          <el-form-item label="SMTP SSL/TLS">
            <el-switch v-model="form.smtp_secure" active-value="true" inactive-value="false" />
          </el-form-item>
          <el-form-item label="SMTP 用户名">
            <el-input v-model="form.smtp_username" placeholder="通常为邮箱地址" />
          </el-form-item>
        </div>
        <el-form-item label="SMTP 密码">
          <el-input v-model="form.smtp_password" type="password" show-password placeholder="留空或保持已配置占位则不修改" />
        </el-form-item>

        <el-divider content-position="left">POP3 / IMAP</el-divider>
        <div class="form-grid">
          <el-form-item label="POP3 主机">
            <el-input v-model="form.pop3_host" placeholder="例如：pop.example.com" />
          </el-form-item>
          <el-form-item label="POP3 端口">
            <el-input v-model="form.pop3_port" placeholder="995" />
          </el-form-item>
          <el-form-item label="POP3 SSL/TLS">
            <el-switch v-model="form.pop3_secure" active-value="true" inactive-value="false" />
          </el-form-item>
          <el-form-item label="IMAP 主机">
            <el-input v-model="form.imap_host" placeholder="例如：imap.example.com" />
          </el-form-item>
          <el-form-item label="IMAP 端口">
            <el-input v-model="form.imap_port" placeholder="993" />
          </el-form-item>
          <el-form-item label="IMAP SSL/TLS">
            <el-switch v-model="form.imap_secure" active-value="true" inactive-value="false" />
          </el-form-item>
        </div>

        <el-divider content-position="left">测试邮件</el-divider>
        <el-form-item label="测试收件邮箱">
          <div class="test-row">
            <el-input v-model="testEmail" placeholder="请输入测试收件邮箱" />
            <el-button :loading="testing" @click="sendTestEmail">发送测试邮件</el-button>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'

const defaultForm = {
  email_enabled: 'false',
  email_from_name: '',
  email_from_address: '',
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_username: '',
  smtp_password: '',
  pop3_host: '',
  pop3_port: '995',
  pop3_secure: 'true',
  imap_host: '',
  imap_port: '993',
  imap_secure: 'true',
}

const configKeys = Object.keys(defaultForm) as Array<keyof typeof defaultForm>
const form = ref({ ...defaultForm })
const originalForm = ref({ ...defaultForm })
const testEmail = ref('')
const testing = ref(false)

async function loadConfig() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    configKeys.forEach((key) => {
      form.value[key] = configMap[key] || defaultForm[key]
      originalForm.value[key] = form.value[key]
    })
  } catch {
    ElMessage.error('加载邮箱配置失败')
  }
}

async function saveConfig() {
  try {
    await configApi.updateConfigs(configKeys.map((key) => ({
      config_key: key,
      config_value: form.value[key],
    })))
    originalForm.value = { ...form.value }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

async function sendTestEmail() {
  if (!testEmail.value) {
    ElMessage.warning('请输入测试收件邮箱')
    return
  }
  testing.value = true
  try {
    await configApi.testEmail({ to: testEmail.value })
    ElMessage.success('测试邮件发送成功')
  } catch (err: any) {
    ElMessage.error(err.message || '测试邮件发送失败')
  } finally {
    testing.value = false
  }
}

function resetForm() {
  form.value = { ...originalForm.value }
}

onMounted(loadConfig)
</script>

<style scoped lang="scss">
.email-config-manage {
  .card-header {
    font-size: 16px;
    font-weight: 600;
  }

  .email-config-form {
    max-width: 980px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }

  .test-row {
    display: flex;
    gap: 12px;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .email-config-manage {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .test-row {
      flex-direction: column;
    }
  }
}
</style>
```

- [ ] **Step 4: Update router**

In `web/src/router/index.ts`, replace the `site-config` child route with:

```ts
{
  path: 'site-config',
  redirect: '/admin/site-config/basic',
},
{
  path: 'site-config/basic',
  name: 'AdminSiteBasicConfig',
  component: () => import('@/views/admin/site-config/BasicConfig.vue'),
  meta: { title: '基础配置', requiresAuth: true, requiresAdmin: true },
},
{
  path: 'site-config/email',
  name: 'AdminSiteEmailConfig',
  component: () => import('@/views/admin/site-config/EmailConfig.vue'),
  meta: { title: '邮箱配置', requiresAuth: true, requiresAdmin: true },
},
```

- [ ] **Step 5: Update admin menu**

In `web/src/views/admin/AdminLayout.vue`, replace the site-config menu item with:

```vue
<el-sub-menu index="site-config">
  <template #title>
    <el-icon><Setting /></el-icon>
    <span>网站配置</span>
  </template>
  <el-menu-item index="/admin/site-config/basic">
    <el-icon><Setting /></el-icon>
    <span>基础配置</span>
  </el-menu-item>
  <el-menu-item index="/admin/site-config/email">
    <el-icon><Message /></el-icon>
    <span>邮箱配置</span>
  </el-menu-item>
</el-sub-menu>
```

Update icon import:

```ts
import { Setting, DataAnalysis, User, Reading, HomeFilled, Files, Picture, Document, Refresh, Message } from '@element-plus/icons-vue'
```

Update `defaultOpeneds`:

```ts
if (route.path.startsWith('/admin/site-config')) {
  return ['site-config']
}
```

- [ ] **Step 6: Build frontend**

Run in `web`:

```powershell
npm run build
```

Expected: Vite build passes.

- [ ] **Step 7: Commit**

Run:

```powershell
git add web/src/views/admin/site-config web/src/router/index.ts web/src/views/admin/AdminLayout.vue web/src/api/index.ts
git commit -m "feat: split site config admin pages"
```

## Task 6: Schema Source and Migration Cleanup

**Files:**
- Modify: `server/src/config/database.ts`
- Modify: `server/src/migrations/001_init_schema.ts`
- Modify: `server/src/migrations/009_password_reset_tokens.ts`

- [ ] **Step 1: Move schema SQL into migration 001**

Create a temporary script at `c:\Users\Administrator\.trae-cn\work\6a2aa557c43e8de25783bb38\extract-init-schema.cjs` with this content:

```js
const fs = require('fs');
const path = require('path');

const root = 'd:\\legado-home';
const databasePath = path.join(root, 'server', 'src', 'config', 'database.ts');
const migrationPath = path.join(root, 'server', 'src', 'migrations', '001_init_schema.ts');
const databaseSource = fs.readFileSync(databasePath, 'utf8');
const match = databaseSource.match(/const sql = `([\s\S]*?)`;\s*await db\.query\(sql\);/);

if (!match) {
  throw new Error('未能从 database.ts 提取 initDatabase schema SQL');
}

const schemaSql = match[1];
const migrationSource = `import type mysql from 'mysql2/promise';

export const name = '001_init_schema';

export async function up(db: mysql.Pool): Promise<void> {
  const sql = ${JSON.stringify(schemaSql)};
  await db.query(sql);
}
`;

fs.writeFileSync(migrationPath, migrationSource, 'utf8');
```

Run:

```powershell
node 'c:\Users\Administrator\.trae-cn\work\6a2aa557c43e8de25783bb38\extract-init-schema.cjs'
```

Expected: `server/src/migrations/001_init_schema.ts` contains the exact current table schema from `database.ts` and no temporary marker text.

- [ ] **Step 2: Slim initDatabase**

In `server/src/config/database.ts`, replace the large schema SQL execution with:

```ts
export async function initDatabase(): Promise<void> {
  const db = getDb();
  await runMigrations(db);

  const admin = await queryOne('SELECT id FROM users WHERE username = ?', [config.admin.username]);
  if (!admin) {
    const passwordHash = bcrypt.hashSync(config.admin.password, 10);
    await execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [config.admin.username, config.admin.email, passwordHash, 'superadmin']
    );
  }
}
```

If the existing `initDatabase()` seeds more default site config or categories, preserve that seeding after `runMigrations(db)` and before returning.

- [ ] **Step 3: Update password reset migration comment**

In `server/src/migrations/009_password_reset_tokens.ts`, replace the old comment lines 7-11 with:

```ts
 *   1. 用户在登录页点击"忘记密码"，输入注册邮箱
 *   2. 后端生成 6 位数字验证码，写入本表
 *   3. 后端通过已配置 SMTP 发送验证码
 *   4. 用户输入验证码 + 新密码 → 后端验证 token 合法且未过期 → 重置密码
```

- [ ] **Step 4: Build backend**

Run:

```powershell
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

Run:

```powershell
git add server/src/config/database.ts server/src/migrations/001_init_schema.ts server/src/migrations/009_password_reset_tokens.ts
git commit -m "refactor: consolidate database schema into migrations"
```

## Task 7: Source Parser Types and Safety Boundary

**Files:**
- Create: `server/src/services/sourceTypes.ts`
- Modify: `server/src/services/ruleExecutor.ts`
- Modify: `server/src/services/safeScriptRunner.ts`
- Modify: `server/src/services/webBookService.ts`
- Modify: `server/src/services/ruleExecutor.test.ts`

- [ ] **Step 1: Create shared source types**

Create `server/src/services/sourceTypes.ts`:

```ts
export interface BookSourceRow {
  id?: number;
  book_source_url: string;
  book_source_name: string;
  book_source_group?: string | null;
  enabled?: number | boolean;
  header?: string | null;
  search_url?: string | null;
  rule_search?: string | null;
  rule_book_info?: string | null;
  rule_toc?: string | null;
  rule_content?: string | null;
  [key: string]: unknown;
}

export interface RuleExecutionContext {
  result?: string | string[] | null;
  html?: string;
  source?: Record<string, unknown>;
}

export interface RuleExecutionResult {
  ok: boolean;
  values: string[];
  reason?: 'empty_rule' | 'js_disabled' | 'js_error' | 'parse_error';
}
```

- [ ] **Step 2: Add safe rule execution helper**

In `server/src/services/ruleExecutor.ts`, import `RuleExecutionResult` and add:

```ts
export function executeRuleResult(rule: string, html: string, isJson: boolean = false): RuleExecutionResult {
  if (!rule || rule.trim() === '') {
    return { ok: false, values: [], reason: 'empty_rule' };
  }
  try {
    const values = executeRule(rule, html, isJson);
    return { ok: values.length > 0, values };
  } catch {
    return { ok: false, values: [], reason: 'parse_error' };
  }
}
```

Keep existing `executeRule` API unchanged for compatibility.

- [ ] **Step 3: Tighten safe script input type**

In `server/src/services/safeScriptRunner.ts`, import `RuleExecutionContext` and replace `ScriptContext` with:

```ts
import type { RuleExecutionContext } from './sourceTypes';

export type ScriptContext = RuleExecutionContext;
```

Keep `ENABLE_SOURCE_JS` default behavior unchanged.

- [ ] **Step 4: Update web book service imports**

In `server/src/services/webBookService.ts`, import:

```ts
import type { BookSourceRow } from './sourceTypes';
```

Use `BookSourceRow` for source arguments in newly touched helper signatures. Do not force a complete rewrite of every `any` in this task.

- [ ] **Step 5: Add tests**

Append to `server/src/services/ruleExecutor.test.ts`:

```ts
import { executeRuleResult } from './ruleExecutor';

test('executeRuleResult reports empty rules without throwing', () => {
  const result = executeRuleResult('', '<html></html>');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty_rule');
  assert.deepEqual(result.values, []);
});

test('executeRuleResult returns parsed values for valid selectors', () => {
  const result = executeRuleResult('h1', '<h1>标题</h1>');
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, ['标题']);
});
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- src/services/ruleExecutor.test.ts
npm run build
```

Expected: focused test and build pass under Node 20.

- [ ] **Step 7: Commit**

Run:

```powershell
git add server/src/services/sourceTypes.ts server/src/services/ruleExecutor.ts server/src/services/safeScriptRunner.ts server/src/services/webBookService.ts server/src/services/ruleExecutor.test.ts
git commit -m "refactor: add source parser safety types"
```

## Task 8: License Private Key Isolation

**Files:**
- Modify: `.gitignore`
- Modify: `license-tools/generate-license.cjs`
- Modify: `license-tools/sign-file.cjs`
- Modify: `license-tools/pack-release.cjs`
- Modify: `license-tools/README.md`
- Modify: `license-tools/UPDATE-GUIDE.md`

- [ ] **Step 1: Ignore secret directory**

Add to `.gitignore`:

```gitignore
.secrets/
```

- [ ] **Step 2: Move private key with the file tool**

Use file operations to create `.secrets/license` and move `license-tools/keys/private.pem` to `.secrets/license/private.pem`. Keep `license-tools/keys/public.pem` in place if tools or releases need it.

If no file move tool is available, use PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path 'd:\legado-home\.secrets\license' | Out-Null
Move-Item -Path 'd:\legado-home\license-tools\keys\private.pem' -Destination 'd:\legado-home\.secrets\license\private.pem'
```

- [ ] **Step 3: Update key path resolution**

In each license tool that reads the private key, use:

```js
const privateKeyPath = process.env.LICENSE_PRIVATE_KEY_PATH
  || path.resolve(__dirname, '..', '.secrets', 'license', 'private.pem');

if (!fs.existsSync(privateKeyPath)) {
  throw new Error(`未找到私钥，请设置 LICENSE_PRIVATE_KEY_PATH 或放置到 ${privateKeyPath}`);
}
```

If the script is inside `license-tools`, adjust the relative path to project root:

```js
path.resolve(__dirname, '..', '.secrets', 'license', 'private.pem')
```

- [ ] **Step 4: Document secret handling**

In `license-tools/README.md`, add:

```markdown
## 私钥管理

私钥不应放在可交付目录或公开仓库中。默认读取：

```text
.secrets/license/private.pem
```

也可以通过环境变量指定：

```powershell
$env:LICENSE_PRIVATE_KEY_PATH='D:\secure\license-private.pem'
```
```

In `license-tools/UPDATE-GUIDE.md`, add the same environment variable instruction for signing update packages.

- [ ] **Step 5: Verify release package excludes private key**

Run the pack script normally. Then inspect the produced release archive or directory and confirm no `private.pem` exists under `release`.

Expected: only public key and license file are included.

- [ ] **Step 6: Commit**

Run:

```powershell
git add .gitignore license-tools/generate-license.cjs license-tools/sign-file.cjs license-tools/pack-release.cjs license-tools/README.md license-tools/UPDATE-GUIDE.md
git commit -m "chore: isolate license private key"
```

## Task 9: Final Verification

**Files:**
- No new files unless fixing verification failures.

- [ ] **Step 1: Install dependencies**

Run in `server` and `web` if package files changed:

```powershell
npm install
```

Expected: lockfiles update cleanly.

- [ ] **Step 2: Backend test**

Run in `server`:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Backend build**

Run in `server`:

```powershell
npm run build
```

Expected: TypeScript build passes.

- [ ] **Step 4: Frontend build**

Run in `web`:

```powershell
npm run build
```

Expected: Vite build passes.

- [ ] **Step 5: Manual smoke test**

Start server and web in separate terminals:

```powershell
npm run dev
```

Check:

- `/admin/site-config` redirects to `/admin/site-config/basic`.
- Admin menu shows “网站配置 > 基础配置 / 邮箱配置”.
- Basic config saves existing site fields.
- Email config saves SMTP/POP3/IMAP fields.
- Email config masks configured SMTP password on reload.
- Test email returns a clear success or SMTP configuration error.
- Forgot password does not return the verification code in the response.
- Login sets a `token` httpOnly cookie and existing Authorization header flow still works.

- [ ] **Step 6: Final commit**

Run:

```powershell
git status --short
git add .
git commit -m "test: verify project hardening and email config"
```

If there are no changes after verification, skip this commit and record that verification passed with no additional edits.

## Self-Review

- Spec coverage: test baseline, Node 20, schema consolidation, repository extraction, parser types, private key isolation, SMTP password reset, cookie auth, and admin submenu split all have tasks.
- Marker scan: no `TBD`, `TODO`, or open-ended implementation markers are required to complete the plan.
- Type consistency: email config keys, route paths, repository function names, and API method names are consistent across backend and frontend tasks.
