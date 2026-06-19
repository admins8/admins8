# Legado Home 服务启动、安全与优化检查报告

检查时间：2026-06-10

## 摘要

本项目当前是本地开发运行模式：前端依赖 Vite 开发服务器，后端依赖 Node/Express 服务，数据库依赖 MySQL。电脑关机后这些进程都会被系统结束，所以再次访问 `http://localhost:5173/` 前必须重新启动相关服务。

安全检查发现：前端生产依赖 `npm audit --omit=dev` 无漏洞；后端生产依赖发现 1 个 critical 级依赖漏洞，来自 `xmldom@0.6.0`。此外，项目存在若干生产化前需要处理的安全与稳定性问题，包括默认密钥/默认管理员密码、密码重置验证码直接返回前端、HTML 广告直出、SVG 上传同源静态访问、登录缺少限流等。

## 需要启动的服务

本地开发模式下需要 3 类服务：

| 服务 | 作用 | 默认地址 | 必须性 |
|---|---|---|---|
| MySQL | 保存用户、书籍、书源、排行榜、配置等数据 | `127.0.0.1:3306` | 后端必须 |
| 后端 Express | 提供 API、数据库访问、书源搜索、上传、后台接口 | `http://localhost:3001` | 前台功能必须 |
| 前端 Vite | 提供本地前台页面和开发热更新 | `http://localhost:5173` | 当前访问地址必须 |

为什么关机后要重启：`npm run dev` 和 `vite` 都只是命令行里的普通进程，不是 Windows 系统服务。电脑关机或重启后，命令行进程会停止，端口 `3001` 和 `5173` 不会自动恢复。

## 推荐启动方式

### 最简单方式

双击项目根目录下的：

```text
一键重启服务.bat
```

这个脚本会调用：

```text
scripts/restart-services.ps1
```

脚本会做这些事：

- 停止占用 `3001` 和 `5173` 的旧进程。
- 尝试启动 MySQL 服务。
- 启动后端 `http://localhost:3001`。
- 启动前端 `http://localhost:5173`。
- 自动打开浏览器访问前台。

### 手动启动方式

1. 启动 MySQL。

如果你使用小皮面板、phpStudy、XAMPP 或 MySQL Installer，需要先在对应工具里启动 MySQL。

2. 启动后端。

```powershell
cd d:\legado-home\server
npm run dev
```

看到类似下面日志表示后端成功：

```text
Legado Web 服务已启动
地址: http://localhost:3001
API:  http://localhost:3001/api
```

3. 启动前端。

```powershell
cd d:\legado-home\web
npx vite --force --host 127.0.0.1 --port 5173
```

看到类似下面日志表示前端成功：

```text
Local: http://localhost:5173/
```

4. 浏览器访问：

```text
http://localhost:5173/
```

### 如果要减少每次手动启动

可以把 `一键重启服务.bat` 添加到桌面快捷方式，或者配置 Windows 任务计划程序开机自动运行。更正式的方式是用 NSSM/PM2 把后端注册成 Windows 服务，并把前端构建成静态文件后由后端或 Nginx 提供。

生产化后推荐模式：

- `web` 执行 `npm run build` 生成 `web/dist`。
- `server` 执行 `npm run build`，再用 `npm run start` 启动。
- 访问后端地址 `http://localhost:3001/`，由后端直接托管前端静态文件。
- 此模式不需要单独启动 Vite `5173`，更稳定，也更适合长期运行。

## 安全发现

### S1 Critical：后端依赖 `xmldom@0.6.0` 存在 critical 漏洞

- 位置：`server/package.json`，第 28 行；`server/src/services/ruleExecutor.ts`，第 203-210 行。
- 证据：后端依赖 `xmldom`，并在 XPath 规则解析中使用 `DOMParser().parseFromString(html, 'text/html')`。`npm audit --omit=dev` 报告 `xmldom <=0.6.0` 存在 critical/high/moderate 多个漏洞。
- 影响：如果攻击者能影响被解析的 XML/HTML 内容或规则输入，可能造成解析绕过、XML 注入或拒绝服务风险。该项目会抓取外部书源内容，所以输入来源包含不可信外部页面。
- 修复建议：优先替换为维护中的 `@xmldom/xmldom`，或移除 XPath 分支，改用 `cheerio`/安全解析器；替换后跑后端测试和书源规则回归。

### S2 High：开发服务器不适合作为长期/生产访问入口

- 位置：`web/package.json`，第 7 行；`web/vite.config.ts`，第 109-130 行；`scripts/restart-services.ps1`，第 101-106 行。
- 证据：前台访问依赖 `vite` 开发服务 `http://localhost:5173`。
- 影响：电脑关机后前端必然打不开；如果把开发服务器暴露到公网，还会带来 HMR/调试接口暴露风险。
- 修复建议：本地开发可继续用 `一键重启服务.bat`；长期运行建议构建 `web/dist`，由后端或 Nginx 托管，不再依赖 `5173`。

### S3 High：默认 JWT 密钥和默认管理员密码存在生产风险

- 位置：`server/src/config/index.ts`，第 20-23 行、第 47-50 行；`server/src/config/database.ts`，第 362-370 行。
- 证据：未配置环境变量时使用默认 JWT secret 和默认管理员密码；初始化日志还会提示默认 `admin/admin123`。
- 影响：如果部署到可被他人访问的环境，攻击者可能用默认管理员账号登录，或利用弱 JWT 密钥伪造 token。
- 修复建议：生产或共享环境必须设置强 `JWT_SECRET`、`ADMIN_PASSWORD`，并修改已有默认管理员密码。

### S4 High：密码重置验证码直接返回给前端

- 位置：`server/src/controllers/authController.ts`，第 176-223 行。
- 证据：`forgotPassword` 生成验证码后直接在响应 `data.token` 返回。
- 影响：任何知道邮箱的人都能申请验证码并在前端拿到，可能重置他人密码。虽然代码注释说明是本地开发便利，但如果上线非常危险。
- 修复建议：生产环境必须改为邮件/短信发送验证码，接口不返回 token；同时对 `forgot-password` 和 `reset-password` 做限流。

### S5 Medium：登录、注册、找回密码接口缺少限流

- 位置：`server/src/routes/auth.ts`，第 15-21 行。
- 证据：存在 `rateLimit` 中间件，但未应用到 `/auth/login`、`/auth/register`、`/auth/forgot-password`、`/auth/reset-password`。
- 影响：登录口令可被暴力尝试，验证码和注册接口也可能被刷。
- 修复建议：给登录/注册/重置密码增加 IP + 账号维度限流；失败次数过多时延迟或短时封禁。

### S6 Medium：SSE 接口通过 URL query 传 token

- 位置：`server/src/middleware/auth.ts`，第 19-30 行；`web/src/api/index.ts`，第 278-287 行、第 323-333 行；`web/src/views/SourceList.vue`，第 663 行。
- 证据：后端允许 `req.query.token`，前端 EventSource URL 拼接 `token=...`。
- 影响：token 可能进入浏览器历史、代理日志、访问日志或 Referer，泄露概率高于 Header。
- 修复建议：优先使用支持自定义 Header 的 SSE polyfill，或改为短期一次性 SSE token；至少不要让通用认证中间件接受 query token，只为 SSE 单独做短期 token 验证。

### S7 Medium：前端 auth token 存在 `localStorage`

- 位置：`web/src/store/auth.ts`，第 7 行、第 24-35 行、第 64 行；`web/src/api/index.ts`，第 20 行。
- 证据：登录 token 存入 `localStorage`，请求时取出放入 `Authorization`。
- 影响：一旦出现 XSS，token 可被脚本直接读取并外传。
- 修复建议：更安全方案是后端设置 HttpOnly Cookie 并配合 CSRF；如果继续用 Bearer token，应缩短有效期、减少 XSS 面、增加 CSP。

### S8 Medium：HTML 广告和统计代码可执行任意 HTML/脚本

- 位置：`web/src/components/AdSlot.vue`，第 29-34 行；`web/src/components/ReaderPopupAd.vue`，第 42-46 行；`web/src/utils/siteConfig.ts`，第 26-45 行。
- 证据：`v-html="ad.content"` 直接渲染 HTML 广告，`setAnalyticsCode` 使用 `innerHTML` 并重新执行脚本。
- 影响：这是有意设计的广告/统计能力，但如果后台账号被盗、广告内容来源不可信，前台会直接执行恶意脚本。
- 修复建议：限制此功能仅 superadmin 可编辑；增加危险提示；如不需要 HTML 广告，改为只允许图片/文字广告。统计代码也建议只允许可信脚本域名或固定模板。

### S9 Medium：允许上传 SVG 并同源静态访问

- 位置：`server/src/controllers/uploadController.ts`，第 7-13 行；`server/src/app.ts`，第 45-50 行。
- 证据：上传白名单包含 `image/svg+xml`，上传目录通过 `/uploads` 静态托管。
- 影响：SVG 是可包含脚本/外链的主动内容。即使用 `<img>` 展示通常不执行脚本，用户直接打开 SVG 时仍有风险；同源访问会放大风险。
- 修复建议：禁用 SVG 上传，或将 SVG 强制作为附件下载并设置严格 CSP/Content-Type。

### S10 Medium：导入书源 URL 的 SSRF 防护不完整

- 位置：`server/src/controllers/sourceController.ts`，第 204-244 行。
- 证据：已阻止部分协议、localhost 和常见私有 IP，但没有 DNS 解析后 IP 校验，也没有限制重定向后的目标。
- 影响：恶意域名可解析到内网 IP，或通过重定向访问内网服务，造成 SSRF。
- 修复建议：请求前解析 hostname 并校验最终 IP；禁用或限制重定向；只允许 `http/https`；必要时做域名白名单。

### S11 Low：MySQL 连接开启 `multipleStatements`

- 位置：`server/src/config/database.ts`，第 13-23 行。
- 证据：全局连接池开启 `multipleStatements: true`。
- 影响：当前大多数查询使用参数化，SQL 注入风险较低；但全局多语句会扩大未来拼接 SQL 时的破坏面。
- 修复建议：普通业务连接关闭 `multipleStatements`；初始化/迁移可以单独使用临时连接或拆分多条语句执行。

## 已有安全优点

- 后端已使用 `helmet()`。
- 请求体设置了 `10mb` 限制。
- 多数 SQL 使用参数化查询。
- 上传文件使用服务端随机文件名，并限制大小为 `2MB`。
- 书源 JS 默认不启用，且使用 `isolated-vm` 隔离执行。
- 阅读内容 `v-html` 前有 `escapeHtml`，不是直接渲染原文 HTML。
- 上传/后台/书源管理等路由大多有认证与管理员权限控制。

## 优化建议

### 运行与部署

1. 将本地开发启动方式保留为 `一键重启服务.bat`。
2. 长期运行改为：前端 `npm run build`，后端 `npm run build && npm run start`，只保留后端一个入口。
3. 用 PM2、NSSM 或 Windows 任务计划程序托管后端和 MySQL，避免每次手动启动。
4. 如果对外开放，建议加 Nginx 反向代理，统一 TLS、gzip/brotli、缓存和安全响应头。

### 安全优先级

1. 先处理 `xmldom` critical 漏洞。
2. 生产前立即更换默认管理员密码和 JWT 密钥。
3. 给登录、注册、找回密码、重置密码加限流。
4. 取消 query token，至少改成 SSE 专用短期 token。
5. 禁用 SVG 上传或改为安全下载。
6. 限制 HTML 广告/统计代码编辑权限，必要时禁用 HTML 广告。

### 性能与代码质量

1. 排行榜、分类、热门搜索等读多写少数据可增加短期缓存。
2. 搜索/换源 SSE 建议增加任务取消、并发上限和队列状态展示。
3. `HomeView.vue`、`Reader.vue`、`BasicData.vue` 已逐渐变大，后续可拆成小组件。
4. 数据库初始化 SQL 和迁移建议进一步拆分，避免全局依赖 `multipleStatements`。
5. 建议新增统一输入校验层，例如 zod/joi，减少各 controller 手动校验不一致。

## 建议下一步

建议优先按以下顺序修复：

1. 替换或移除 `xmldom`。
2. 给认证相关接口加限流。
3. 禁止 SVG 上传。
4. 移除通用 query token，只为 SSE 使用短期 token。
5. 增加生产启动脚本，把前端 dist 交给后端托管。

