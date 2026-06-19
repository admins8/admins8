# 项目加固后续修复设计

## 背景

本项目已经具备前后端分离阅读站、书源解析、管理后台、授权校验、在线升级、数据库维护和 Docker 交付能力。当前代码整体可构建，后端测试通过，但在前后端接口一致性、生产部署强校验、原生模块部署、私钥交付边界、横向扩展状态管理和前端测试覆盖方面仍有明确改进点。

本设计覆盖以下六项后续修复：

1. 修复 `/sources/import` 前后端不一致。
2. 处理 `isolated-vm` ABI 不匹配在启用书源 JS 时的部署风险。
3. 梳理 `.secrets`、license 私钥和发布包边界。
4. 增加生产部署强校验，禁止默认密钥和默认管理员密码上线。
5. 将限流优先迁移到 Redis，访问统计保留兼容并预留 Redis 化边界。
6. 为前端补充基础单元测试能力。

## 目标

- 保持现有功能兼容，不改变用户主要操作流程。
- 优先修复明确缺口，降低生产部署误配置风险。
- 保持默认开发体验简单，生产环境执行更严格的安全校验。
- Redis 相关改造采用“可用则启用、不可用则降级”的方式，避免单点依赖导致服务不可用。
- 前端测试先建立最小可运行体系，为后续页面和 E2E 测试打基础。

## 非目标

- 不重构整个书源解析引擎。
- 不一次性把所有访问统计数据改为 Redis 存储。
- 不引入完整 E2E 测试矩阵，只补基础测试脚本和关键单元测试。
- 不改变现有 license 签发格式和客户部署目录结构。
- 不强制开发环境必须安装或成功加载 `isolated-vm`。

## 方案选择

采用“小步修复 + 渐进加固”方案。

相比一次性重构限流、统计、缓存和部署流程，该方案改动面更小，能快速修复明确 bug，并把生产安全边界补齐。Redis 改造先从限流入手，因为限流天然依赖短期共享状态，收益直接；访问统计先做边界梳理，避免引入复杂一致性问题。

## 后端接口设计

### `/sources/import`

后端新增 `POST /api/sources/import`，与前端 `sourceApi.importSources()` 对齐。

接口行为：

- 请求体为数组时，按书源数组导入。
- 请求体为单个对象时，按单个书源导入。
- 请求体为字符串时，尝试按 JSON 解析；解析后如果是数组或对象，复用同一导入流程。
- 非法 JSON 或不支持的数据结构返回 `{ code: 400, msg }`。

实现方式：

- 在 `server/src/controllers/sourceController.ts` 中提取或新增 `importSources` 控制器。
- 复用当前 `addSource` 中的批量入库逻辑，避免两套导入逻辑分叉。
- 在 `server/src/routes/source.ts` 中新增 `router.post('/import', importSources)`。
- 保留 `/sources/import-url` 现有行为不变。

错误处理：

- 参数缺失或格式错误返回业务错误 `400`。
- 单条书源导入失败不影响其他书源，返回成功和失败明细。
- 数据库级异常返回 `500`。

## 原生模块设计

### `isolated-vm` 检测

新增原生模块检测脚本：

`server/scripts/check-native-modules.cjs`

检测逻辑：

- 尝试 `require('isolated-vm')`。
- 如果加载成功，输出通过。
- 如果加载失败且 `ENABLE_SOURCE_JS=true`，退出码为 `1`，提示执行 `npm rebuild isolated-vm` 或重新安装依赖。
- 如果加载失败但未启用书源 JS，退出码为 `0`，只输出警告。

服务启动逻辑：

- 在 `server/src/config` 下增加运行时检查函数。
- 生产或启用 `ENABLE_SOURCE_JS=true` 时，启动前检查 `isolated-vm` 可用性。
- 默认 `ENABLE_SOURCE_JS=false` 时保持现有安全降级，不阻塞开发启动。

文档更新：

- 在 `README.md`、`README_WEB.md` 或发布说明中保留并强化 `npm rebuild isolated-vm` 说明。
- 明确只有启用可信书源 JS 时才需要该模块可用。

## 授权边界设计

### 私钥与发布包

边界规则：

- `.secrets/` 只能作为供应商本地签发目录。
- `private.pem` 不得进入 release 包、更新包、客户交付包或 Docker 镜像。
- 客户交付包只能包含 `public.pem`、`license.lic` 或 `PLACE_LICENSE_HERE.txt`。

实现方式：

- 检查并补强 `.gitignore`，忽略 `.secrets/`、私钥文件和 license 工具临时输出。
- 在 `license-tools` 文档中说明私钥、公钥、license 的边界。
- 在打包脚本中增加发布前扫描，发现 `private.pem` 或 `.secrets` 出现在输出目录时拒绝继续。

验收标准：

- `release/` 和 `dist/` 中不能出现 `private.pem`。
- 打包脚本能在误包含私钥时失败。
- 文档明确供应商私钥不能交付客户。

## 生产校验设计

### 强校验模块

新增模块：

`server/src/config/productionGuard.ts`

校验触发条件：

- `NODE_ENV=production` 时强制执行。
- 可在启动早期执行，早于数据库初始化和监听端口。

禁止项：

- `JWT_SECRET` 为空。
- `JWT_SECRET` 等于默认示例值或 `CHANGE_ME_IN_PRODUCTION`。
- `ADMIN_PASSWORD` 为空。
- `ADMIN_PASSWORD` 等于 `admin123`、`CHANGE_ME` 或其他示例弱密码。
- 生产环境缺少 license 文件。

行为：

- 开发环境只保留警告，不阻塞启动。
- 生产环境校验失败时抛出明确错误并拒绝启动。

相关文件：

- `server/src/config/index.ts`：移除或保留 warning，但生产强校验由新模块负责。
- `server/src/app.ts`：启动流程早期调用强校验。
- `.env.example`、`.env.docker.example`、Docker/发布 README：提示生产必须修改密钥。

## Redis 迁移设计

### 限流

先改造 `server/src/middleware/rateLimit.ts`。

行为：

- Redis 启用且连接可用时，使用 Redis key 记录 IP 在窗口内的请求数。
- Redis 不可用时，回退到当前内存 `Map` 实现。
- Redis 异常只影响限流精度，不影响业务接口可用性。

Key 设计：

- `legado:ratelimit:{windowMs}:{ip}`
- TTL 使用当前限流窗口秒数。

实现边界：

- 不要求每次请求重新建立 Redis 连接。
- 复用或抽象现有 Redis 连接能力，避免 `searchCache.ts` 和 `rateLimit.ts` 各自维护不可控连接。

### 访问统计

本阶段不全量迁移 `visitorStats.ts`。

只做以下改进：

- 标注当前统计状态仍以 MySQL 为准。
- 如果需要短期去重或高频写入优化，后续可引入 Redis 缓冲。
- 不改变当前访客统计结果口径。

## 前端测试设计

### 测试框架

引入：

- `vitest`
- `@vue/test-utils`
- `jsdom`

脚本：

- `npm test`：运行单元测试。
- 可选 `npm run test:watch`：本地开发监听。

首批测试覆盖：

- 现有 `web/src/utils/seo.test.ts` 纳入测试运行。
- 为 API 响应解包函数 `unwrapResponse` 增加测试。
- 如路由权限辅助函数需要测试，先将其从 router 文件提取为可测试工具，否则本阶段不强行重构。

验收标准：

- `web` 目录执行 `npm test` 通过。
- `npm run build` 继续通过。
- 不要求启动浏览器 E2E。

## 验证计划

后端验证：

- `npm test`
- `npm run build`
- 手动或测试验证 `/api/sources/import` 支持数组、对象和 JSON 字符串。
- 在模拟生产环境下验证默认密钥会拒绝启动。

前端验证：

- `npm test`
- `npm run build`

部署边界验证：

- 运行打包脚本时确认发布目录不含 `private.pem`。
- 检查 README 和 license 工具文档包含私钥不交付说明。

## 风险与缓解

### Redis 连接复用风险

如果直接复用搜索缓存内部连接，可能让不同模块互相影响。实现时应抽出轻量 Redis 客户端工具，或者保持模块隔离但统一降级策略。

### 生产强校验误伤

开发环境不能被强校验阻塞。强校验只在 `NODE_ENV=production` 时拒绝启动，其他环境仅提示。

### 书源导入兼容性

不同书源文件字段可能存在 Legado 原始命名和项目内部命名差异。本次先复用现有 `addSource` 行为，不扩大字段映射范围，避免引入新的导入语义。

### 前端测试引入依赖

新增测试依赖会改变 `package-lock.json`。需要在最终验证中同时运行测试和构建，确认不影响生产构建。

## 实施顺序

1. 修复 `/sources/import` 路由和控制器。
2. 增加生产部署强校验。
3. 增加 `isolated-vm` 检测脚本和启动校验。
4. 补强 `.gitignore`、license 文档和打包脚本扫描。
5. 改造限流为 Redis 优先、内存回退。
6. 补前端测试依赖、脚本和基础测试。
7. 运行后端测试、后端构建、前端测试、前端构建。

