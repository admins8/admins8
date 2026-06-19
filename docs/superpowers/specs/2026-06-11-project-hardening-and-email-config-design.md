# 项目稳定性、安全与邮箱配置优化设计

## 背景

当前项目已经具备较完整的前后端分离架构、书源解析、管理后台、授权校验、系统升级、缓存和发布能力，但存在几类需要优先收敛的问题：测试基线未完全通过、Node 版本未锁定、数据库 schema 来源分散、controller 中 SQL 偏多、书源解析边界需要加强、私钥文件应隔离、找回密码和 token 存储策略需要生产化。

本次优化采用分阶段实施，先恢复测试与运行环境基线，再逐步完成结构收敛和安全增强。后台“网站配置”将拆分为两个二级菜单：“基础配置”和“邮箱配置”。邮箱配置用于保存 POP3、SMTP、IMAP 参数，并优先接入 SMTP 找回密码验证码发送。

## 目标

- 修复后端测试基线，使 `npm test` 可稳定通过。
- 将 Node.js 运行基线锁定为 Node 20 LTS。
- 统一数据库建表来源到 migrations，减少 `database.ts` 中的 schema 维护负担。
- 将与本次改造相关的 controller SQL 下沉到 repository 层。
- 加强书源解析模块的类型定义、错误边界和安全默认值。
- 隔离 license 私钥，避免私钥随项目或交付包暴露。
- 将找回密码从“直接返回验证码”改为通过 SMTP 发送验证码。
- 将登录 token 策略从仅依赖 `localStorage` 逐步迁移到 httpOnly Cookie，并兼容现有前端。
- 在后台“网站配置”下建立“基础配置”和“邮箱配置”两个二级菜单。

## 非目标

- 不重写整个书源解析引擎。
- 不一次性迁移所有 controller 的全部 SQL。
- 不实现完整邮件收件业务，POP3/IMAP 本次只作为配置项保存和预留。
- 不强制立即移除前端所有 `localStorage token` 逻辑，先做兼容过渡。
- 不删除私钥内容，优先采用隔离迁移和 `.gitignore` 防护。

## 阶段设计

### 测试与 Node 基线

Node.js 版本锁定为 Node 20 LTS。项目根目录新增 `.nvmrc`，后端和前端 `package.json` 增加 `engines.node` 约束，文档补充本地开发和部署时的版本要求。

当前后端测试失败点有两个。`isolated-vm` 失败属于原生模块 ABI 与当前 Node 版本不匹配，锁定 Node 20 后需要通过重新安装依赖或 `npm rebuild isolated-vm` 恢复。`sourceAvailability` 测试与实现不一致，当前实现默认要求至少 10 个有效章节，本次保留 10 章规则并修正测试名称与样例。

### 数据库 schema 收敛

`server/src/config/database.ts` 保留连接池、查询辅助函数、事务和初始化入口，但不再维护完整业务表结构。初始建表逻辑迁入 `server/src/migrations/001_init_schema.ts`，后续变更继续由 `002+` 迁移负责。

`initDatabase()` 的职责调整为：创建数据库连接、确保迁移表存在、执行 migrations、初始化默认管理员和默认配置。迁移记录仍使用 `schema_migrations`。

### 数据访问层

新增 `server/src/repositories`。优先抽离与本次改造直接相关的模块：

- `siteConfigRepository.ts`：读取、批量更新、按 key 更新配置。
- `userRepository.ts`：按用户名/邮箱查找用户、按 ID 查找用户、更新密码、写入密码重置 token。
- `emailConfigRepository.ts`：基于 `site_config` 存取邮箱配置。

controller 保留 HTTP 参数处理和响应，SQL、事务和字段映射下沉到 repository。

### 书源解析安全边界

为书源解析核心对象补充更明确的类型边界，包括 `BookSourceRow`、`BookCandidate`、`ChapterResult`、`RuleExecutionContext` 和 `RuleExecutionResult`。`ENABLE_SOURCE_JS` 继续默认关闭。

`safeScriptRunner` 保持 isolated-vm 沙箱，并明确只接受字符串脚本和有限上下文。规则解析失败、JS 被禁用、JS 执行失败、HTTP 超时和目录不足等情况要返回可控失败，不应抛出到顶层导致搜索整体崩溃。

### 私钥隔离

将 `license-tools/keys/private.pem` 迁移到本地隔离目录 `.secrets/license/private.pem`。`.secrets/` 加入 `.gitignore`。license 工具优先读取环境变量 `LICENSE_PRIVATE_KEY_PATH`，未配置时提示用户指定私钥路径。

交付包和 release 包只允许包含公钥、license 文件和运行所需资源，不包含私钥。

### 邮箱配置

后台“网站配置”拆成两个二级菜单：

- `基础配置`：承接当前网站标题、副标题、Logo、默认封面、域名、备案、首页 SEO、统计代码、版权信息。
- `邮箱配置`：管理 SMTP、POP3、IMAP 参数。

邮箱配置字段：

- `email_enabled`
- `email_from_name`
- `email_from_address`
- `smtp_host`
- `smtp_port`
- `smtp_secure`
- `smtp_username`
- `smtp_password`
- `pop3_host`
- `pop3_port`
- `pop3_secure`
- `imap_host`
- `imap_port`
- `imap_secure`

SMTP 密码不在接口中明文回显。前端加载时显示为“已配置”占位状态，只有重新填写才覆盖旧值。后台提供“发送测试邮件”功能，用于验证 SMTP 配置。

### 找回密码生产化

当前 `forgotPassword` 会直接返回验证码。本次改为：

1. 用户提交邮箱。
2. 后端生成验证码并保存到 `password_reset_tokens`。
3. 如果邮箱发送已启用且 SMTP 配置完整，通过 SMTP 发送验证码。
4. 响应只返回发送结果，不返回验证码。
5. 如果 SMTP 未配置或发送失败，返回明确错误。

本地开发可以通过环境变量启用开发回显，但默认关闭，生产环境禁止直接返回验证码。

### Token 策略

登录和注册成功后，后端除返回兼容响应外，还设置 httpOnly Cookie。鉴权中间件继续支持 Header、Cookie、Query 的读取顺序，其中 Header 保持兼容，Cookie 作为新推荐方式。

新增登出接口或扩展现有登出逻辑，清除 Cookie。前端过渡期继续可读取 `localStorage token`，但 API 请求应支持仅依赖 Cookie 的模式。完全切换 Cookie 后，应增加 CSRF 防护。

## 前端路由设计

后台路由调整为：

```text
/admin/site-config/basic
/admin/site-config/email
```

建议文件结构：

```text
web/src/views/admin/site-config/BasicConfig.vue
web/src/views/admin/site-config/EmailConfig.vue
```

`AdminLayout.vue` 中“网站配置”菜单变为可展开父菜单，包含“基础配置”和“邮箱配置”。旧 `/admin/site-config` 路由重定向到 `/admin/site-config/basic`。

## 后端接口设计

复用现有配置接口：

- `GET /api/config`
- `PUT /api/config/batch`

新增邮箱测试接口：

- `POST /api/config/email/test`

请求参数：

```json
{
  "to": "user@example.com"
}
```

返回：

```json
{
  "code": 0,
  "msg": "测试邮件发送成功"
}
```

## 数据迁移设计

新增迁移用于补充邮箱配置默认项。邮箱配置继续存储在 `site_config`，避免引入新的配置表。SMTP 密码字段后续可升级为加密存储；本次至少保证接口不回显明文。

如果迁移过程中发现 `database.ts` 与现有 migrations 字段不一致，以当前运行数据库结构和最新 migrations 为准，迁移前需检查字段兼容。

## 验收标准

- 后端 `npm test` 全部通过。
- 后端 `npm run build` 通过。
- 前端 `npm run build` 通过。
- 项目明确锁定 Node 20 LTS。
- `isolated-vm` 不再因 Node ABI 不一致导致测试失败。
- `sourceAvailability` 测试与实现规则一致。
- 数据库初始 schema 主要来源于 `001_init_schema.ts`。
- 与站点配置、邮箱配置、找回密码相关的 SQL 下沉到 repository。
- 后台存在“网站配置 > 基础配置”和“网站配置 > 邮箱配置”两个二级菜单。
- 邮箱配置页面可保存 SMTP、POP3、IMAP 参数，并可发送测试邮件。
- 找回密码验证码通过 SMTP 发送，默认不再返回验证码。
- 登录或注册后后端设置 httpOnly Cookie，现有 Header token 方式仍兼容。
- 私钥文件不再位于可交付路径，`.secrets/` 被忽略。

## 风险与处理

- `isolated-vm` 对 Node 和编译环境敏感。处理方式是锁定 Node 20，并在文档中要求依赖重装或 rebuild。
- schema 收敛可能影响已有数据库。处理方式是先迁移代码来源，不删除历史迁移，并保持幂等建表。
- 邮件发送依赖第三方 SMTP 服务。处理方式是提供测试邮件接口和清晰错误提示。
- Cookie token 迁移可能影响前端上传和跳转。处理方式是保留 Header token 兼容，逐步迁移。
- 私钥迁移可能影响现有 license 工具。处理方式是支持环境变量路径，并提供 README 更新说明。
