# 书源订阅与安全加固设计

## 范围

本轮只修改本地项目代码，不执行服务器同步、发布包上传或远程部署。

## 目标

1. 书源管理删除“添加书源”和“生成书源”能力，只保留导入、编辑、验证、删除。
2. 新增订阅源导入能力，支持单个订阅源 `/yuedu/rss/json/id/*.json` 和集合订阅源 `/yuedu/rsss/json/id/*.json`。
3. 订阅源独立存储，先完成导入、管理、浏览和阅读入口，不混入现有小说书源表。
4. 完成安全加固：替换 `xmldom`、认证限流、移除通用 query token、禁用 SVG 上传、关闭普通业务连接的 `multipleStatements`。
5. 逐步拆分大文件：前端 API 从单文件拆为模块；后端书源解析服务拆出 HTTP、规则、搜索、详情/目录/正文边界；大型 Vue 页面先从书源管理开始拆分。
6. 增加关键测试，覆盖订阅源导入、安全行为和前端页面入口。

## 订阅源模型

新增 `rss_sources` 表，字段保存 Legado RSS 源的原始能力：

- `source_url`：订阅源地址，唯一。
- `source_name`：订阅源名称。
- `source_group`：分组。
- `source_icon`：图标。
- `source_comment`：备注。
- `enabled`、`custom_order`、`article_style`、`single_url`、`enable_js`、`enabled_cookie_jar`、`header`、`sort_url`。
- `rule_articles`、`rule_title`、`rule_link`、`rule_image`、`rule_pub_date`、`rule_content`、`rule_next_page`。
- `raw_json`：完整源 JSON，便于后续兼容字段。

单源接口返回对象时导入 1 条；集合接口返回数组时批量导入。集合中缺少 `sourceUrl` 的目录/占位项不导入，计入失败原因。

## 后端接口

新增 `/api/rss-sources` 路由，复用登录与 `source_manage` 权限：

- `GET /api/rss-sources`：列表。
- `POST /api/rss-sources/import-url`：从 URL 导入单源或集合源。
- `POST /api/rss-sources/delete`：删除。
- `PUT /api/rss-sources/:id`：启用、分组、排序等基础编辑。
- `GET /api/rss-sources/:id/articles`：按订阅源规则抓取文章列表。
- `GET /api/rss-sources/:id/content`：按文章链接读取内容。

## 前端交互

书源管理页顶部只保留“书源导入”“订阅源导入”“一键验证”“批量删除”。移除“添加书源”和“生成书源”按钮、弹窗、API 调用。

新增订阅源管理入口，先放在书源管理页内作为标签页：

- “小说书源”：现有书源列表。
- “订阅源”：订阅源列表、导入按钮、删除、启用/禁用。
- 订阅源详情页或弹窗展示文章列表。
- 点击文章打开阅读弹窗或独立阅读视图。

## 安全加固

1. `xmldom` 替换为 `@xmldom/xmldom`，XPath 分支继续保留，但改用维护包。
2. `/api/auth/login`、`/register`、`/forgot-password`、`/reset-password` 添加限流。
3. `authMiddleware` 不再从 query 读取 token。现有 fetch 流式 SSE 已使用 Authorization header，继续保持。
4. 上传白名单移除 `image/svg+xml`。
5. 普通 MySQL 连接关闭 `multipleStatements`；迁移 SQL 拆分执行或迁移使用独立连接。

## 拆分策略

前端 API 拆为：

- `web/src/api/request.ts`
- `web/src/api/types.ts`
- `web/src/api/authApi.ts`
- `web/src/api/bookApi.ts`
- `web/src/api/sourceApi.ts`
- `web/src/api/rssSourceApi.ts`
- `web/src/api/adminApi.ts`
- `web/src/api/configApi.ts`
- `web/src/api/index.ts` 只做聚合导出，降低一次性改动风险。

后端 `webBookService.ts` 拆为：

- `bookSourceHttpClient.ts`：请求头、URL 配置、HTTP 抓取。
- `bookRuleParser.ts`：规则执行与结果提取。
- `bookSearchService.ts`：搜索解析。
- `bookReaderService.ts`：详情、目录、正文。
- `webBookService.ts` 保持外部兼容导出，避免一次性改动全部调用方。

## 测试

新增或更新：

- 订阅源 URL 类型识别、payload 归一化、导入映射测试。
- XPath 规则执行测试，确认 `@xmldom/xmldom` 替换后行为不变。
- 认证路由限流测试。
- 上传 SVG 拒绝测试。
- 前端 API 模块导出测试。
- 书源管理页面入口测试，确认不再显示添加/生成书源，显示订阅源导入。

## 非目标

- 本轮不执行服务器同步。
- 本轮不处理远程真实站点可用性保证。
- 本轮不把 RSS 源强行转换成小说书源。
- 本轮不重做整个前端后台导航，只在书源管理相关区域增量接入。
