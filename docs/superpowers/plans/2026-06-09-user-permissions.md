# 用户功能权限实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让超级管理员可以在用户管理后台给普通用户勾选或取消“书源管理”权限。

**Architecture:** 后端增加 `user_permissions` 表和权限中间件，管理员角色默认拥有功能权限，普通用户需要被显式授权。前端用户管理页展示权限勾选，路由和导航根据 `permissions` 控制书源管理入口。

**Tech Stack:** Express、TypeScript、MySQL、Vue 3、Pinia、Element Plus。

---

### Task 1: 后端权限模型

**Files:**
- Create: `server/src/migrations/002_user_permissions.ts`
- Create: `server/src/services/permissionService.ts`
- Modify: `server/src/config/migrations.ts`
- Modify: `server/src/config/database.ts`

- [ ] 增加 `user_permissions` 表，字段为 `user_id`、`permission_key`。
- [ ] 增加 `getUserPermissions()` 和 `setUserPermissions()`。
- [ ] 保持 `admin`、`superadmin` 默认拥有所有功能权限。

### Task 2: 权限中间件与书源保护

**Files:**
- Modify: `server/src/middleware/auth.ts`
- Modify: `server/src/routes/source.ts`

- [ ] 增加 `permissionMiddleware('source_manage')`。
- [ ] 书源管理接口要求管理员角色或 `source_manage` 权限。

### Task 3: 用户管理接口

**Files:**
- Modify: `server/src/controllers/adminController.ts`
- Modify: `server/src/routes/admin.ts`

- [ ] 用户列表返回 `permissions`。
- [ ] 新增 `POST /api/admin/users/permissions` 更新用户权限。
- [ ] 禁止修改自己的功能权限。

### Task 4: 登录态与前端权限

**Files:**
- Modify: `server/src/controllers/authController.ts`
- Modify: `web/src/api/index.ts`
- Modify: `web/src/store/auth.ts`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/App.vue`

- [ ] 登录和个人信息返回权限数组。
- [ ] 前端用户类型增加 `permissions`。
- [ ] 路由和导航支持 `source_manage` 权限。

### Task 5: 用户管理页面

**Files:**
- Modify: `web/src/views/admin/UserManage.vue`

- [ ] 增加“功能权限”列。
- [ ] 给普通用户展示“书源管理”开关。
- [ ] 勾选后调用后端权限更新接口。

### Task 6: 验证

**Commands:**
- `npm run build` in `server`
- `npm run build` in `web`

- [ ] 后端构建通过。
- [ ] 前端构建通过。
- [ ] 开发服务重启后页面可访问。
