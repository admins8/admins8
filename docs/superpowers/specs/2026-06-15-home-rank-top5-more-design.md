# 首页主列「排行榜」Top5 + 更多按钮 设计

**日期：** 2026-06-15

## 目标
首页主列的「排行榜」区块最多显示前 5 名书籍，并在底部增加一个“更多”按钮，点击跳转到现有的独立排行榜页 `/ranking`。

## 背景
- 首页 `web/src/views/HomeView.vue` 主列使用 `hotRankings` 渲染，目前未限制条数。
- 项目已存在路由 `/ranking`（`RankingView.vue`），是独立的排行榜总页。
- 前端 `homeApi.getHotRankings` 支持 `limit` 透传，后端 `getHotRankings` 也支持 `limit` 参数。
- 右侧「人气榜」区块已有“查看全部”入口，本次不改它，避免越界改动。

## 范围
仅修改 `web/src/views/HomeView.vue`：
1. 调用 `homeApi.getHotRankings({ limit: 5 })`，把请求条数压到 5。
2. 模板兜底再次截断：`hotRankings.slice(0, 5)`，避免后端返回多于 5 条时显示超额。
3. 在 `.rank-list` 后新增“更多 →”按钮，使用 `router-link` 跳转 `/ranking`，复用已有视觉风格（与右栏 `ranking-cta` 类似）。
4. 给“更多”按钮加最少必要的样式（贴近现有 `ranking-cta`），不引入新颜色变量。

不改：
- 后端接口和数据库；
- 右栏「人气榜」；
- `/ranking` 页本身；
- 其他后台/管理逻辑。

## 行为细节
- 后端返回少于 5 条：按钮仍展示，只渲染已有条数，不报错。
- 后端返回 0 条：保留原有空态行为（沿用现有逻辑），按钮可保留也可隐藏；本次保持简单——按钮恒显，方便用户随时进入 `/ranking`。
- 桌面端与手机端共用同一按钮，沿用现有响应式样式即可。

## 验收
- 首页主列「排行榜」最多 5 条。
- 主列「排行榜」底部出现“更多 →”按钮，点击跳到 `/ranking`。
- 不影响首页其他区块、`/ranking` 页和右侧人气榜。
- 不破坏移动端已有的统一满宽布局。

## 测试策略
- 增加一个轻量 Node 校验脚本，断言 `HomeView.vue` 中：
  - `getHotRankings` 调用使用 `limit: 5`；
  - 模板里 `hotRankings` 渲染处使用 `.slice(0, 5)`；
  - 模板里出现指向 `/ranking` 的“更多”按钮。
- 构建后用浏览器打开 `https://so.soumal.com/` 在 PC 和手机宽度下观察主列条数和按钮跳转。
