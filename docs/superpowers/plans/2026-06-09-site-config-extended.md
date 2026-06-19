# 网站配置扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展后台网站配置，支持 Web 域名、WAP 域名、ICP备案号、统计代码、版权信息、首页标题、首页关键字、首页描述，并在前端应用展示。

**Architecture:** 继续复用 `site_config` 键值表，不新增业务表。后台网站配置页批量读取和保存配置；前端首页应用 SEO 配置，全站底部展示版权和备案号，全站加载统计代码。

**Tech Stack:** Express、TypeScript、MySQL、Vue 3、Element Plus。

---

### Task 1: 默认配置项

**Files:**
- Modify: `server/src/config/database.ts`

- [ ] 给 `site_config` 初始化插入新增默认配置项：`web_domain`、`wap_domain`、`icp_number`、`analytics_code`、`copyright`、`home_title`、`home_keywords`、`home_description`。

### Task 2: 前端配置工具

**Files:**
- Create: `web/src/utils/siteConfig.ts`

- [ ] 增加 `configsToMap()`，把后端配置数组转为对象。
- [ ] 增加 `setMetaTag()`，用于设置 `keywords` 和 `description`。
- [ ] 增加 `setAnalyticsCode()`，用于替换并注入统计代码。

### Task 3: 后台表单

**Files:**
- Modify: `web/src/views/admin/SiteConfig.vue`

- [ ] 扩展表单字段和保存字段。
- [ ] 分组展示：基础信息、域名与备案、首页 SEO、统计代码。
- [ ] 保存后触发全局配置更新事件。

### Task 4: 首页 SEO

**Files:**
- Modify: `web/src/views/HomeView.vue`

- [ ] 读取全部配置。
- [ ] 使用 `home_title` 设置首页标题。
- [ ] 使用 `home_keywords` 和 `home_description` 设置 meta。

### Task 5: 全站底部与统计

**Files:**
- Modify: `web/src/App.vue`

- [ ] 加载全站配置。
- [ ] 底部显示版权信息。
- [ ] 底部显示 ICP 备案号，并链接到备案查询网站。
- [ ] 注入统计代码。

### Task 6: 验证

**Commands:**
- `npm run build` in `server`
- `npm run build` in `web`

- [ ] 后端构建通过。
- [ ] 前端构建通过。
- [ ] 重启前后端服务。
