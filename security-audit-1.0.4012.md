# 1.0.4012 安全检查报告

## 摘要

本次检查确认存在“前台公开配置泄露敏感信息”的高危问题，已在 `1.0.4012` 中完成止血修复并上线。当前外网验证结果显示：公开配置接口、首页源码、排行榜源码不再出现邮箱、密码、token、secret 等敏感字段；直接访问敏感配置 key 已返回未授权。

同时发现若干后续需要继续加固的问题，包括前端 `v-html` 渲染、浏览器 `localStorage` 保存登录 token、书源规则动态执行等。

## 已修复

### S-001 公开配置接口泄露敏感配置

- 严重级别：Critical
- 位置：`server/src/routes/siteConfig.ts:8-12`
- 证据：原先公开路由复用完整配置读取逻辑，导致前台可读取邮箱、SMTP/POP3/IMAP、密码等配置。
- 影响：任何访问者都可能通过公开接口或 HTML 源码读取服务端敏感配置。
- 修复：
  - `server/src/routes/siteConfig.ts:8-12` 将公开接口限定为 `getPublicConfigs` / `getPublicConfig`，管理员接口放到 `authMiddleware, adminMiddleware` 之后。
  - `server/src/controllers/siteConfigController.ts:56-90` 新增公开配置读取逻辑。
  - `server/src/services/publicSiteConfig.ts:1-52` 新增公开配置白名单和敏感 key 拦截。
- 验证：
  - `https://soumal.com/api/config/public/all` 不再包含敏感字段。
  - `https://soumal.com/api/config/smtp_password` 返回 `401`。

### S-002 HTML 源码注入完整站点配置

- 严重级别：Critical
- 位置：`server/src/services/seoHtmlService.ts:225`
- 证据：`site-config-json` 曾注入完整 `site_config`，会把服务端配置写入前台 HTML 源码。
- 影响：即使接口修复，如果静态 HTML 或动态 HTML 注入完整配置，查看源码仍可能泄露敏感信息。
- 修复：`server/src/services/seoHtmlService.ts:225` 改为 `filterPublicSiteConfigMap(configs)`，只注入公开白名单字段。
- 验证：首页源码和排行榜源码扫描未出现邮箱、密码、token、secret 等字段。

### S-003 单项配置读取接口未鉴权

- 严重级别：Critical
- 位置：`server/src/routes/siteConfig.ts:9-14`
- 证据：原 `/api/config/:key` 位于鉴权中间件之前，知道配置 key 即可尝试读取配置值。
- 影响：攻击者可直接请求敏感 key。
- 修复：公开单项配置改为 `/api/config/public/:key` 且白名单限制；原 `/api/config/:key` 移到管理员鉴权之后。
- 验证：敏感 key 直接访问返回 `401`。

### S-004 后台百度推送插件读取接口返回原始 token

- 严重级别：High
- 位置：`server/src/controllers/collectorPluginController.ts`、`server/src/services/baiduPushPlugin.ts`
- 证据：读取插件配置时会返回原始 token。
- 影响：管理员页面、浏览器插件、XSS 或抓包环境可能拿到长期 token。
- 修复：新增后台读取专用方法，读取配置时只返回 `maskedToken`，不返回原始 token；推送时服务端仍从数据库读取原始 token。

### S-005 本地旧构建和旧压缩包残留真实账号

- 严重级别：High
- 位置：`server/src/services/emailService.test.ts:44-52`、旧交付压缩包
- 证据：测试样例和旧压缩包内存在真实邮箱账号样例。
- 影响：真实账号不应进入测试代码或可分发压缩包。
- 修复：测试样例替换为 `noreply@example.com`；已删除命中的旧交付压缩包。
- 验证：残留扫描结果为 `TEXT_HITS 0`、`ZIP_HITS 0`。

## 待加固

### S-101 前端存在多处 `v-html`

- 严重级别：High
- 位置：
  - `web/src/views/Reader.vue:50`
  - `web/src/views/StaticPage.vue:5`
  - `web/src/components/ReaderPopupAd.vue:45`
  - `web/src/components/AdSlot.vue:33`
- 影响：如果小说正文、静态页、广告内容中混入恶意 HTML，可能形成 XSS。
- 建议：引入 HTML sanitizer 白名单清洗；广告和静态页内容限制允许标签；阅读正文优先转义文本，只允许必要段落格式。

### S-102 登录 token 存在 `localStorage`

- 严重级别：Medium / High
- 位置：
  - `web/src/store/auth.ts:7`
  - `web/src/store/auth.ts:24`
  - `web/src/store/auth.ts:35`
  - `web/src/api/index.ts:21`
- 影响：一旦发生 XSS，攻击者可直接读取 token。
- 建议：逐步迁移到 HttpOnly Cookie 鉴权；前端不再保存 token；服务端配合 CSRF 防护。

### S-103 动态执行书源/规则脚本

- 严重级别：High
- 位置：
  - `server/src/services/bookSourceHttpClient.ts:267`
  - `server/src/services/webBookService.ts:286`
  - `server/src/services/ruleExecutor.ts:160`
  - `server/src/services/safeScriptRunner.ts:35`
- 影响：书源规则或采集规则如果来自不可信来源，可能触发服务端代码执行或沙箱逃逸风险。
- 建议：默认禁用不可信脚本；仅允许管理员导入；使用隔离执行器、超时、内存限制和 API 白名单；记录脚本来源和签名。

### S-104 邮箱授权码已暴露，需要外部轮换

- 严重级别：Critical
- 影响：代码修复只能阻止继续泄露，不能让已暴露的授权码重新变安全。
- 建议：立即到邮箱服务商后台撤销旧授权码，重新生成新授权码；再到后台邮箱配置中填入新授权码。

## 验证记录

- 线上版本：`1.0.4012`
- 公开接口扫描：无敏感字段命中
- 首页源码扫描：无敏感字段命中
- 排行榜源码扫描：无敏感字段命中
- 敏感 key 直接访问：`401`
- 本地源码/zip 残留扫描：`TEXT_HITS 0`、`ZIP_HITS 0`
- 测试：`12/12 pass`
