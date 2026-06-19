# API 探测生成书源设计

## 目标

在现有“生成单个书源 + 复制 JSON + 一键导入”的基础上，增加 API 探测模式。用户可以输入小说站首页、书库页或搜索页，系统尝试发现页面暴露的公开 API，请求 API 后从 JSON 响应里推断 JSONPath 规则，生成更接近 YCK 接口型书源的单个书源 JSON。

## 范围

第一版只做安全、可解释的公开接口探测，不做绕过 Cloudflare、破解签名、破解 Token、模拟登录或逆向私有 App 协议。若目标接口需要 `Authorization`、签名、设备 ID 或访问验证，系统允许用户手动填写请求头并在诊断信息中说明限制。

## 用户流程

用户在书源管理中点击“生成书源”。弹窗提供“网页模式”和“API 探测模式”。网页模式沿用当前逻辑。API 探测模式允许输入目标 URL、测试关键词、书源名称和自定义请求头。系统生成后展示 JSON、诊断信息、命中的 API 地址和推断出的规则，用户可以复制 JSON 或一键导入。

## 后端设计

`sourceGenerator.ts` 扩展 `GenerateSourceInput`：

- `mode?: 'html' | 'api'`
- `headers?: Record<string, string>`

新增 API 探测能力：

- 从 HTML 中提取 API 候选：`SearchAction`、`form[action]`、内联脚本、外链脚本里的 `/api/`、`search`、`book`、`novel`、`rank` 等路径。
- 组合请求头：默认移动浏览器请求头、JSON API 请求头、用户自定义请求头。
- 请求候选 API：优先搜索接口，使用测试关键词替换 `{{key}}`。
- 判断 JSON 响应：只对对象或数组做 JSONPath 推断。
- 推断搜索规则：识别列表路径、书名、作者、封面、简介、分类、字数、书籍 ID 或详情路径。
- 生成接口型书源：`ruleSearch` 使用 JSONPath，`searchUrl` 指向命中的 API。

## 前端设计

`SourceList.vue` 的生成弹窗新增：

- 模式选择：网页模式 / API 探测模式。
- 请求头编辑框：JSON 文本，默认给出常用请求头模板。
- 诊断结果继续使用现有警告区域展示。
- API 探测模式下提示：仅探测页面公开接口，不绕过访问验证、签名和登录。

## 错误处理

请求头 JSON 无效时，前端直接提示格式错误，不发请求。后端也会校验 `headers` 必须是简单字符串键值对。目标 URL 仍走现有 SSRF 防护。接口探测失败时不返回 500，而是返回基础 JSON 草稿和明确诊断。

## 验证

新增后端测试覆盖：

- 从 HTML/脚本中提取 API 搜索候选。
- 从 JSON 响应推断 `$.data[*]`、`$.novelName`、`$.authorName` 等 JSONPath。
- 使用 API 规则生成可导入书源 JSON。
- 自定义请求头会合并到生成结果的 `header`。

构建验证：

- `npm test -- --test-name-pattern 'api source|inferJson|extractApi'`
- `npm run build` in `server`
- `npm run build` in `web`
