# 阅读页增强与全站响应式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为阅读页增加浏览器听书、阅读设置、背景/字体/翻页控制，并优化手机、平板、电脑自适应体验。

**Architecture:** 主要在 `web/src/views/Reader.vue` 内扩展，避免引入后端依赖；听书使用浏览器 `speechSynthesis`。阅读设置保存到 `localStorage`，页面样式通过 CSS 变量和动态 style 应用。全站响应式优先修正 `App.vue`、后台布局、书架、首页、阅读页等主要页面。

**Tech Stack:** Vue 3、Pinia、Element Plus、Web Speech API、CSS/SCSS media query、localStorage。

---

### Task 1: 阅读设置模型

**Files:**
- Modify: `web/src/views/Reader.vue`

- [ ] **Step 1: 增加阅读设置状态**

新增 `readerSettings`，包含 `fontSize`、`lineHeight`、`theme`、`contentWidth`、`tapTurnPage`、`volumeTurnPage`。

- [ ] **Step 2: 增加本地保存**

使用 `localStorage` key：`reader_settings_v1`。进入阅读页时读取，设置变化时保存。

- [ ] **Step 3: 应用样式**

将 `reader-content` 的字号、行高、背景、文字颜色、内容宽度改为从设置读取。

### Task 2: 设置面板

**Files:**
- Modify: `web/src/views/Reader.vue`

- [ ] **Step 1: 顶部增加设置按钮**

在换源和目录按钮之间增加设置按钮。

- [ ] **Step 2: 增加设置抽屉**

抽屉包含字体大小、行高、阅读背景、内容宽度、点击翻页、音量键翻页。

- [ ] **Step 3: 保留底部字体按钮**

底部加减按钮继续可用，但改为更新统一设置模型。

### Task 3: 浏览器听书

**Files:**
- Modify: `web/src/views/Reader.vue`

- [ ] **Step 1: 增加听书状态**

增加 `speechSupported`、`isSpeaking`、`isPaused`、`speechRate`、`speechPitch`、`selectedVoiceName`、`availableVoices`。

- [ ] **Step 2: 增加听书操作**

实现开始、暂停、继续、停止。章节切换和离开阅读页时停止朗读。

- [ ] **Step 3: 设置抽屉加入听书设置**

可选择声音、调节语速、调节音调。

### Task 4: 翻页增强

**Files:**
- Modify: `web/src/views/Reader.vue`

- [ ] **Step 1: 点击区域翻页**

阅读内容左 25% 点击上一章，右 25% 点击下一章，中间点击显示/隐藏工具栏。

- [ ] **Step 2: 键盘翻页**

保留左右键和 PageUp/PageDown，增加空格下一章。

- [ ] **Step 3: 手机/平板音量键翻页**

浏览器通常不能直接读取系统音量键，但部分移动浏览器会把音量键映射为键盘事件。增加 `AudioVolumeUp`、`AudioVolumeDown`、`VolumeUp`、`VolumeDown`、`MediaTrackNext`、`MediaTrackPrevious` 兼容处理；如果浏览器不暴露这些事件，则不强制报错。

### Task 5: 全站响应式

**Files:**
- Modify: `web/src/App.vue`
- Modify: `web/src/views/HomeView.vue`
- Modify: `web/src/views/BookShelf.vue`
- Modify: `web/src/views/admin/AdminLayout.vue`
- Modify: `web/src/views/admin/UserManage.vue`
- Modify: `web/src/views/admin/SiteConfig.vue`
- Modify: `web/src/views/admin/BookManage.vue`
- Modify: `web/src/views/admin/HomeContent.vue`

- [ ] **Step 1: 顶部导航适配**

小屏压缩导航间距和字体，避免横向溢出。

- [ ] **Step 2: 首页与书架适配**

小屏改为单列布局，卡片、搜索框和内容列宽度自适应。

- [ ] **Step 3: 后台适配**

后台侧栏在小屏改为横向滚动菜单，内容区域 padding 缩小，表格保留横向滚动。

### Task 6: 验证

**Files:**
- Verify only

- [ ] **Step 1: 构建验证**

Run: `npm run build` in `web`

Expected: build success.

- [ ] **Step 2: 重启前端**

Run: `npx vite --force --host 127.0.0.1 --port 5173`

Expected: `Local: http://127.0.0.1:5173/`

- [ ] **Step 3: 手动验证**

检查阅读页设置、听书按钮、字体/背景/行高/宽度、点击翻页、键盘翻页和移动端窄屏布局。
