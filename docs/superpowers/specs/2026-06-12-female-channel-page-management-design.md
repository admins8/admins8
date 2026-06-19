# 女生频道页面管理设计

## 背景

后台需要在「内容管理」下新增「页面管理」，并在其下新增「女生频道」。前台女生频道页面参考 `https://www.soumal.com/home/girls.html`，采用传统小说站频道页布局，而不是大横幅首页式布局。

当前项目已有「基础数据」管理热门搜索、排行榜、标签等内容，但这些数据偏首页通用。女生频道需要一套独立的页面区块管理能力，既能管理推荐位，也能管理分类推荐，还应便于后续扩展男生频道、漫画频道、出版频道等频道页。

## 目标

1. 前台新增女生频道页面，路径同时支持 `/girls` 和 `/home/girls.html`。
2. 页面布局参考搜猫现有女生频道：左栏推荐 + 中/右栏分类推荐 + 底部更新列表。
3. 后台新增菜单层级：`内容管理 → 页面管理 → 女生频道`。
4. 后台可以管理女生频道的页面基础信息、推荐区块、分类区块和书籍条目。
5. 数据结构设计为可复用频道模型，女生频道只是第一条频道数据，标识为 `female`。

## 非目标

1. 本次不实现复杂拖拽排序，先用数字排序字段。
2. 本次不实现自动从书源抓取封面和简介，后台先支持手动填写或复制已有书籍信息。
3. 本次不强制做大图幻灯片。参考页实际是传统推荐卡片布局，因此首版以推荐区块为主。
4. 本次不做男生频道、漫画频道等其他页面，只预留数据结构扩展能力。

## 前台页面设计

### 路由

前台新增两个访问路径：

- `/girls`
- `/home/girls.html`

两个路径指向同一个 Vue 页面组件，页面标题由后台配置读取。

### 页面布局

页面主体采用宽度 `1200px` 的居中容器。首屏按用户确认后的布局调整为两列：

- 左栏：`380px`，编辑推荐
- 右栏：`800px`，幻灯片

首屏布局：

```text
左栏：编辑推荐
右栏：幻灯片
```

中段布局：

```text
中段以下保持参考页结构不变：
左栏：小编力荐
中栏：幻情 / 青春 / 科幻
右栏：仙侠 / 游戏 / 悬疑
```

后段布局：

```text
左栏：晋级新书 / 新书首秀
中栏/右栏：各分类推荐
底部：最新更新 / 最新入库 / 最多更新
```

### 区块展示类型

前台区块支持以下展示类型：

- `editor_pick`：编辑推荐，左栏竖向文本推荐。
- `hero_slider`：首屏右侧幻灯片，后台可配置图片、标题、简介、跳转链接、排序和启用状态。
- `feature_large`：主编推荐、小编力荐、晋级新书、新书首秀，包含 1 本主推书 + 多本辅助书。
- `category_grid`：古言、现言、幻情、仙侠、青春、游戏、科幻、悬疑等分类区块，展示 1 到 2 本书。
- `update_list`：最新更新、最新入库、最多更新，列表型展示。

首版可以先实现这些类型，不做额外视觉变体。

## 后台设计

### 菜单结构

后台左侧菜单新增：

```text
内容管理
  页面管理
    女生频道
```

「页面管理」作为二级菜单，未来可以继续挂：

```text
男生频道
漫画频道
出版频道
```

### 女生频道管理页

后台页面建议使用 Tab 结构：

```text
页面设置
编辑推荐
幻灯片
主编推荐
小编力荐
晋级新书
新书首秀
分类推荐
更新列表
```

### 页面设置

字段：

- 频道名称，例如：女生频道
- 频道标识，固定为：`female`
- 页面路径：`/girls`
- 兼容路径：`/home/girls.html`
- SEO 标题
- SEO 关键词
- SEO 描述
- 是否启用

### 区块管理

每个区块字段：

- 区块标题
- 区块编码，例如：`editor_recommend`、`chief_recommend`、`ancient_romance`
- 展示类型
- 更多链接
- 排序
- 是否启用

### 条目管理

每个条目字段：

- 书名
- 作者
- 封面图
- 简介
- 分类
- 字数
- 最新章节
- 跳转链接
- 排序
- 是否启用

图片字段先支持 URL 输入。后续如果需要，可以复用现有上传接口加「上传封面」按钮。

## 后端设计

### 数据表

新增三张表。

#### `page_channels`

频道主表：

- `id`
- `code`
- `name`
- `path`
- `compat_path`
- `seo_title`
- `seo_keywords`
- `seo_description`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

#### `page_sections`

频道区块表：

- `id`
- `channel_code`
- `section_code`
- `title`
- `display_type`
- `more_link`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

#### `page_section_items`

区块条目表：

- `id`
- `section_id`
- `title`
- `author`
- `cover_url`
- `intro`
- `category`
- `word_count`
- `latest_chapter`
- `link_url`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

### API

公开接口：

```text
GET /api/pages/channels/:code
```

用于前台读取频道页面所有配置和内容。

管理接口：

```text
GET    /api/admin/pages/channels/:code
PUT    /api/admin/pages/channels/:code
POST   /api/admin/pages/channels/:code/sections
PUT    /api/admin/pages/sections/:id
POST   /api/admin/pages/sections/delete
POST   /api/admin/pages/sections/:id/items
PUT    /api/admin/pages/items/:id
POST   /api/admin/pages/items/delete
POST   /api/admin/pages/channels/:code/seed
```

`seed` 接口用于首次生成女生频道默认区块，不重复创建已有区块。

### 权限

后台页面管理需要管理员权限：

- 读取：`admin`
- 修改：`admin`

如果后续需要更严格权限，可以单独增加 `page_manage` 权限。

## 前端设计

### 新增页面

前台：

- `web/src/views/FemaleChannel.vue`

后台：

- `web/src/views/admin/page-manage/FemaleChannelManage.vue`

### 前端 API

在 `web/src/api/index.ts` 增加：

- `pageApi.getChannel(code)`
- `pageAdminApi.getChannel(code)`
- `pageAdminApi.updateChannel(code, payload)`
- `pageAdminApi.createSection(code, payload)`
- `pageAdminApi.updateSection(id, payload)`
- `pageAdminApi.deleteSection(id)`
- `pageAdminApi.createItem(sectionId, payload)`
- `pageAdminApi.updateItem(id, payload)`
- `pageAdminApi.deleteItem(id)`
- `pageAdminApi.seedChannel(code)`

### 路由

前台：

```text
/girls
/home/girls.html
```

后台：

```text
/admin/page-manage/female
```

### 管理页面交互

女生频道后台页面：

1. 页面加载时请求 `pageAdminApi.getChannel('female')`。
2. 如果没有数据，显示「初始化女生频道」按钮。
3. 点击初始化后调用 `seedChannel('female')` 创建默认频道和默认区块。
4. 管理员可编辑页面设置。
5. 管理员可在各 Tab 中新增、编辑、删除条目。
6. 保存后前台刷新即可看到变化。

## 默认区块

女生频道初始化时创建以下区块：

```text
编辑推荐 editor_recommend
幻灯片 hero_slider
主编推荐 chief_recommend
古言 ancient_romance
现言 modern_romance
幻情 fantasy_romance
仙侠 xianxia
小编力荐 editor_force
青春 youth
游戏 game
科幻 sci_fi
悬疑 mystery
晋级新书 rising_new
新书首秀 new_debut
最新更新 latest_updates
最新入库 latest_added
最多更新 most_updated
```

## 错误处理

1. 前台接口失败时显示空状态，不影响整站其他页面。
2. 频道未启用时返回 404 或显示「页面暂未开放」。
3. 后台保存失败时展示接口错误消息。
4. 删除区块前提示会同时隐藏或删除其下条目。
5. 删除条目前二次确认。

## 测试与验证

### 后端

1. 运行 TypeScript 编译。
2. 验证迁移创建三张表。
3. 验证 `seed` 接口不会重复插入。
4. 验证公开接口只返回启用的区块和条目。
5. 验证后台接口需要管理员登录。

### 前端

1. 运行前端构建。
2. 打开 `/girls` 能看到女生频道页面。
3. 打开 `/home/girls.html` 能看到同一页面。
4. 后台菜单能进入 `内容管理 → 页面管理 → 女生频道`。
5. 后台新增、编辑、删除条目后，前台页面内容同步变化。

## 兼容性说明

1. 新增功能不影响现有首页、排行榜、书架、阅读页。
2. 不修改现有 `hot_searches`、`hot_rankings`、`hot_tags` 表。
3. 不移动现有「基础数据」功能。
4. 后续频道页可以复用三张新表，不需要重复设计新表。

## 自检结论

本设计没有未定项。实现范围聚焦在女生频道页面管理，不包含其他频道。数据结构支持复用但首版只落地女生频道。前台布局依据参考页面的三列传统小说频道页实现，后台以可维护的 Tab 管理方式实现。
