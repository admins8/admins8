// 校验 HomeView.vue 中首页主列「排行榜」实现规则：
// 1. 调用 homeApi.getHotRankings({ limit: 5 })
// 2. 模板渲染处使用 hotRankings.slice(0, 5)
// 3. 模板中存在指向 /ranking 的“更多”按钮（包含“更多”文案）
// 4. “更多”按钮应与主列“排行榜”标题位于同一标题行
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert'

const file = resolve(process.cwd(), 'web/src/views/HomeView.vue')
const src = readFileSync(file, 'utf8')

assert.match(src, /getHotRankings\(\s*\{\s*limit:\s*5\s*\}\s*\)/, 'getHotRankings 应当传入 { limit: 5 }')
assert.match(src, /v-for="\(book, index\) in hotRankings\.slice\(0,\s*5\)"/, '主列排行榜模板应当使用 hotRankings.slice(0, 5)')
assert.match(src, /to="\/ranking"[^>]*class="rank-more"[\s\S]*?更多/, '主列排行榜应当存在指向 /ranking 的“更多”按钮')
assert.match(src, /<div class="rank-header">\s*<h3 class="column-title no-border">排行榜<\/h3>\s*<router-link to="\/ranking" class="rank-more">更多<\/router-link>\s*<\/div>/, '“更多”按钮应当位于排行榜标题右侧且不带箭头')
assert.doesNotMatch(src, /class="rank-more">更多\s*→<\/router-link>/, '“更多”按钮不应显示箭头标记')
assert.match(src, /getHotRankings\(\s*\{\s*type:\s*'new'\s*,\s*limit:\s*5\s*\}\s*\)/, "新书榜数据请求应当传入 { type: 'new', limit: 5 }")
assert.doesNotMatch(src, /getHotRankings\(\s*\{\s*type:\s*'popularity'\s*,\s*limit:\s*5\s*\}\s*\)/, '不应再请求 popularity 类型作为右侧榜单')
assert.match(src, /<h3 class="column-title no-border">新书榜<\/h3>/, '右侧卡片标题应当为“新书榜”')
assert.doesNotMatch(src, /<h3 class="column-title no-border">人气榜<\/h3>/, '右侧卡片标题不应再为“人气榜”')
assert.match(src, /v-for="\(book, idx\) in topRankings\.slice\(0,\s*5\)"/, '首页新书榜模板应当只渲染 topRankings 前 5 条')
assert.doesNotMatch(src, /class="ranking-cta"[\s\S]*?进入排行总榜/, '首页人气榜底部不应显示“进入排行总榜”入口')

console.log('home rank top5 + more rules OK')
