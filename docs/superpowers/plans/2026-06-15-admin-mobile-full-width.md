# 手机版后台满宽自适应 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让后台管理所有页面在手机端统一接近满宽显示，只保留 0-4px 安全边距，并让卡片和表格在内部滚动。

**Architecture:** 在 `AdminLayout.vue` 的移动端媒体查询中增加统一兜底规则，集中覆盖后台内容区、Element Plus 卡片、工具栏、表格包装层、分页和弹窗的移动端边距。页面级样式只在已知问题页做补充，避免逐页重复。

**Tech Stack:** Vue 3、Vite、SCSS、Element Plus、Node.js 脚本校验。

---

### Task 1: 移动端样式回归校验

**Files:**
- Create: `web/src/views/admin/adminMobileLayoutRules.test.mjs`
- Read: `web/src/views/admin/AdminLayout.vue`

- [ ] **Step 1: 写入失败校验**

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'

const content = fs.readFileSync(new URL('./AdminLayout.vue', import.meta.url), 'utf8')
const mobileBlock = content.slice(content.indexOf('@media (max-width: 768px)'))

assert.match(mobileBlock, /\.admin-dashboard\s*\{[\s\S]*?padding:\s*0\s+4px;/, '手机端后台外层安全边距必须收敛到 4px')
assert.match(mobileBlock, /:deep\(\.el-card__body\)[\s\S]*?padding:\s*10px\s+4px/, '手机端卡片内容必须压缩左右边距')
assert.match(mobileBlock, /:deep\(\.el-table__inner-wrapper\)[\s\S]*?overflow-x:\s*auto/, '手机端表格内部必须可横向滚动')
assert.match(mobileBlock, /:deep\(\.el-form-item\)[\s\S]*?margin-bottom:\s*12px/, '手机端表单项必须统一紧凑间距')
```

- [ ] **Step 2: 运行校验确认失败**

Run: `node web/src/views/admin/adminMobileLayoutRules.test.mjs`

Expected: FAIL，提示缺少 4px 安全边距或缺少 Element Plus 移动端兜底规则。

### Task 2: 实现统一移动端满宽规则

**Files:**
- Modify: `web/src/views/admin/AdminLayout.vue`

- [ ] **Step 1: 修改移动端外层边距**

在 `@media (max-width: 768px)` 中把 `.admin-dashboard` 调整为：

```scss
.admin-dashboard {
  min-height: calc(100vh - 120px);
  padding: 0 4px;
}
```

- [ ] **Step 2: 增加后台内容统一兜底**

在同一个媒体查询内 `.admin-content` 规则中追加：

```scss
:deep(.el-card) {
  border-radius: 10px;
}

:deep(.el-card__header) {
  padding: 10px 4px;
}

:deep(.el-card__body) {
  padding: 10px 4px;
}

:deep(.el-table__inner-wrapper) {
  overflow-x: auto;
}

:deep(.el-table) {
  width: 100%;
  min-width: 640px;
}

:deep(.el-form-item) {
  margin-bottom: 12px;
}

:deep(.el-form-item__label) {
  padding-right: 6px;
}

:deep(.el-pagination) {
  justify-content: center;
  white-space: normal;
}
```

- [ ] **Step 3: 运行校验确认通过**

Run: `node web/src/views/admin/adminMobileLayoutRules.test.mjs`

Expected: PASS，无输出或退出码 0。

### Task 3: 构建、部署和线上验证

**Files:**
- Read: `web/dist`
- Use generated update package from build workflow

- [ ] **Step 1: 在临时构建目录安装依赖并构建**

Run: `npm install --no-audit --no-fund` then `npm run build` inside the temporary web build folder.

Expected: Vite build succeeds and emits a new `AdminLayout-*.css`.

- [ ] **Step 2: 打包并上传安装**

Run the existing update package workflow to produce `update.zip` and `update.zip.sig`, then upload/install through `/api/admin/update/upload` and `/api/admin/update/install`.

Expected: upload returns `code: 0`; install returns `success: true`; `/api/health` returns `200`.

- [ ] **Step 3: 手机宽度验证**

Use browser width under 768px and verify:

```js
const content = document.querySelector('.admin-content')
const card = document.querySelector('.el-card')
const tableWrapper = document.querySelector('.el-table__inner-wrapper')
({
  innerWidth: window.innerWidth,
  contentLeft: content.getBoundingClientRect().left,
  contentRightGap: window.innerWidth - content.getBoundingClientRect().right,
  cardPadding: card ? getComputedStyle(card.querySelector('.el-card__body')).padding : null,
  tableOverflowX: tableWrapper ? getComputedStyle(tableWrapper).overflowX : null,
})
```

Expected: `contentLeft` and `contentRightGap` are no more than 4px, card body horizontal padding is 4px, and table wrapper `overflowX` is `auto`.
