# Female Channel Page Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable female channel page with a `1200px` layout, `380px` editor recommendation column, `800px` slider column, and backend management under `内容管理 → 页面管理 → 女生频道`.

**Architecture:** Add a reusable channel-page data model with `page_channels`, `page_sections`, and `page_section_items`. Backend exposes public read API and admin CRUD/seed APIs. Frontend adds `/girls` and `/home/girls.html` public routes plus an admin management page that edits channel settings, slider, recommendations, categories, and update lists.

**Tech Stack:** Express + TypeScript + MySQL migrations on the backend; Vue 3 + Vue Router + Element Plus + existing Axios wrapper on the frontend.

---

## File Structure

- Create `server/src/migrations/016_page_channels.ts`: creates page channel tables and seeds the female channel defaults.
- Modify `server/src/config/migrations.ts`: registers migration 016.
- Create `server/src/services/pageChannelService.ts`: encapsulates public channel read, admin read, seed, and CRUD logic.
- Create `server/src/controllers/pageController.ts`: converts HTTP requests to service calls.
- Create `server/src/routes/page.ts`: public/admin page-channel routes.
- Modify `server/src/app.ts`: mounts public `/api/pages` and admin `/api/admin/pages` routes.
- Modify `web/src/api/index.ts`: adds `pageApi` and `pageAdminApi`.
- Create `web/src/views/FemaleChannel.vue`: renders the public female channel page.
- Create `web/src/views/admin/page-manage/FemaleChannelManage.vue`: admin management UI.
- Modify `web/src/router/index.ts`: adds public and admin routes.
- Modify `web/src/views/admin/AdminLayout.vue`: adds `内容管理 → 页面管理 → 女生频道`.

---

### Task 1: Database migration

**Files:**
- Create: `server/src/migrations/016_page_channels.ts`
- Modify: `server/src/config/migrations.ts`

- [ ] **Step 1: Add migration file**

Create `server/src/migrations/016_page_channels.ts` with SQL that creates:

```ts
import type { Pool } from 'mysql2/promise'

export async function up(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS page_channels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      path VARCHAR(255) NOT NULL,
      compat_path VARCHAR(255) DEFAULT NULL,
      seo_title VARCHAR(255) DEFAULT NULL,
      seo_keywords VARCHAR(500) DEFAULT NULL,
      seo_description TEXT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS page_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel_code VARCHAR(64) NOT NULL,
      section_code VARCHAR(64) NOT NULL,
      title VARCHAR(100) NOT NULL,
      display_type VARCHAR(64) NOT NULL,
      more_link VARCHAR(255) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_channel_section (channel_code, section_code),
      INDEX idx_page_sections_channel (channel_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS page_section_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      section_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(100) DEFAULT NULL,
      cover_url VARCHAR(500) DEFAULT NULL,
      intro TEXT DEFAULT NULL,
      category VARCHAR(50) DEFAULT NULL,
      word_count VARCHAR(50) DEFAULT NULL,
      latest_chapter VARCHAR(255) DEFAULT NULL,
      link_url VARCHAR(500) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_page_items_section (section_id),
      CONSTRAINT fk_page_items_section FOREIGN KEY (section_id) REFERENCES page_sections(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
}
```

- [ ] **Step 2: Register migration**

Add migration 016 to `server/src/config/migrations.ts` using the existing pattern.

- [ ] **Step 3: Verify backend compiles**

Run:

```powershell
cd D:\legado-home\server
npx tsc --noEmit
```

Expected: no TypeScript errors.

---

### Task 2: Backend service and controller

**Files:**
- Create: `server/src/services/pageChannelService.ts`
- Create: `server/src/controllers/pageController.ts`

- [ ] **Step 1: Implement service**

`pageChannelService.ts` defines:

```ts
export async function getPublicChannel(code: string)
export async function getAdminChannel(code: string)
export async function updateChannel(code: string, payload: ChannelPayload)
export async function seedChannel(code: string)
export async function createSection(code: string, payload: SectionPayload)
export async function updateSection(id: number, payload: SectionPayload)
export async function deleteSection(id: number)
export async function createItem(sectionId: number, payload: ItemPayload)
export async function updateItem(id: number, payload: ItemPayload)
export async function deleteItem(id: number)
```

Default seed sections:

```ts
[
  ['editor_recommend', '编辑推荐', 'editor_pick'],
  ['hero_slider', '幻灯片', 'hero_slider'],
  ['chief_recommend', '主编推荐', 'feature_large'],
  ['ancient_romance', '古言', 'category_grid'],
  ['modern_romance', '现言', 'category_grid'],
  ['fantasy_romance', '幻情', 'category_grid'],
  ['xianxia', '仙侠', 'category_grid'],
  ['editor_force', '小编力荐', 'feature_large'],
  ['youth', '青春', 'category_grid'],
  ['game', '游戏', 'category_grid'],
  ['sci_fi', '科幻', 'category_grid'],
  ['mystery', '悬疑', 'category_grid'],
  ['rising_new', '晋级新书', 'feature_large'],
  ['new_debut', '新书首秀', 'feature_large'],
  ['latest_updates', '最新更新', 'update_list'],
  ['latest_added', '最新入库', 'update_list'],
  ['most_updated', '最多更新', 'update_list'],
]
```

- [ ] **Step 2: Implement controller**

`pageController.ts` exports one function per route. Success response shape:

```ts
res.json({ code: 0, data })
```

Failure response shape:

```ts
res.status(status).json({ code: status, msg: error.message })
```

- [ ] **Step 3: Verify compile**

Run:

```powershell
cd D:\legado-home\server
npx tsc --noEmit
```

Expected: no TypeScript errors.

---

### Task 3: Backend routes

**Files:**
- Create: `server/src/routes/page.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Add route file**

Public:

```ts
router.get('/channels/:code', getPublicChannelHandler)
```

Admin:

```ts
router.get('/channels/:code', authMiddleware, adminMiddleware, getAdminChannelHandler)
router.put('/channels/:code', authMiddleware, adminMiddleware, updateChannelHandler)
router.post('/channels/:code/seed', authMiddleware, adminMiddleware, seedChannelHandler)
router.post('/channels/:code/sections', authMiddleware, adminMiddleware, createSectionHandler)
router.put('/sections/:id', authMiddleware, adminMiddleware, updateSectionHandler)
router.post('/sections/delete', authMiddleware, adminMiddleware, deleteSectionHandler)
router.post('/sections/:id/items', authMiddleware, adminMiddleware, createItemHandler)
router.put('/items/:id', authMiddleware, adminMiddleware, updateItemHandler)
router.post('/items/delete', authMiddleware, adminMiddleware, deleteItemHandler)
```

- [ ] **Step 2: Mount routes**

In `server/src/app.ts`:

```ts
app.use('/api/pages', publicPageRoutes)
app.use('/api/admin/pages', adminPageRoutes)
```

- [ ] **Step 3: Verify compile**

Run:

```powershell
cd D:\legado-home\server
npx tsc --noEmit
```

Expected: no TypeScript errors.

---

### Task 4: Frontend API and routes

**Files:**
- Modify: `web/src/api/index.ts`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/views/admin/AdminLayout.vue`

- [ ] **Step 1: Add API methods**

Add `pageApi.getChannel(code)` and `pageAdminApi` methods matching backend routes.

- [ ] **Step 2: Add routes**

Public:

```ts
{ path: '/girls', name: 'FemaleChannel', component: () => import('@/views/FemaleChannel.vue') }
{ path: '/home/girls.html', name: 'FemaleChannelCompat', component: () => import('@/views/FemaleChannel.vue') }
```

Admin:

```ts
{ path: 'page-manage/female', name: 'AdminFemaleChannelManage', component: () => import('@/views/admin/page-manage/FemaleChannelManage.vue') }
```

- [ ] **Step 3: Add menu**

In `AdminLayout.vue`, add nested menu:

```text
内容管理
  页面管理
    女生频道
```

- [ ] **Step 4: Verify frontend build**

Run:

```powershell
cd D:\legado-home\web
npm run build
```

Expected: build succeeds.

---

### Task 5: Public female channel page

**Files:**
- Create: `web/src/views/FemaleChannel.vue`

- [ ] **Step 1: Render loading/empty/data states**

Load `pageApi.getChannel('female')`. If disabled or missing, show empty message. If loaded, render sections.

- [ ] **Step 2: Implement layout**

Use `1200px` centered container. First screen:

```text
380px editor recommendation + 800px slider
```

Middle and lower areas keep the reference-style channel structure.

- [ ] **Step 3: Verify frontend build**

Run:

```powershell
cd D:\legado-home\web
npm run build
```

Expected: build succeeds and output includes `FemaleChannel`.

---

### Task 6: Admin female channel page

**Files:**
- Create: `web/src/views/admin/page-manage/FemaleChannelManage.vue`

- [ ] **Step 1: Implement initialize button**

If backend returns no channel, show `初始化女生频道` button and call `pageAdminApi.seedChannel('female')`.

- [ ] **Step 2: Implement page settings tab**

Editable fields:

```text
频道名称、页面路径、兼容路径、SEO标题、SEO关键词、SEO描述、启用状态
```

- [ ] **Step 3: Implement section/item management**

Tabs:

```text
编辑推荐、幻灯片、主编推荐、小编力荐、晋级新书、新书首秀、分类推荐、更新列表
```

Each item supports add/edit/delete:

```text
标题、作者、封面图、简介、分类、字数、最新章节、跳转链接、排序、启用状态
```

- [ ] **Step 4: Verify frontend build**

Run:

```powershell
cd D:\legado-home\web
npm run build
```

Expected: build succeeds and output includes `FemaleChannelManage`.

---

## Self-Review

- Spec coverage: every confirmed requirement is mapped to tasks: route, menu, database, public layout, admin management, width `1200px`, first-screen `380px + 800px`, and reusable page-channel model.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: backend uses channel/section/item naming consistently; frontend API names match route names.
