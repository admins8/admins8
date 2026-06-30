import assert from 'node:assert/strict'
import fs from 'node:fs'

const content = fs.readFileSync(new URL('./AdminLayout.vue', import.meta.url), 'utf8')
const mobileBlock = content.slice(content.indexOf('@media (max-width: 768px)'))
const appContent = fs.readFileSync(new URL('../../App.vue', import.meta.url), 'utf8')

assert.match(mobileBlock, /\.admin-dashboard\s*\{[\s\S]*?padding:\s*0\s+4px;/, '手机端后台外层安全边距必须收敛到 4px')
assert.match(mobileBlock, /:deep\(\.el-card__body\)[\s\S]*?padding:\s*10px\s+4px\s*!important/, '手机端卡片内容必须强制压缩左右边距')
assert.match(mobileBlock, /:deep\(\.el-table__inner-wrapper\)[\s\S]*?overflow-x:\s*auto/, '手机端表格内部必须可横向滚动')
assert.match(mobileBlock, /:deep\(\.el-form-item\)[\s\S]*?margin-bottom:\s*12px/, '手机端表单项必须统一紧凑间距')
assert.match(appContent, /class="app-main"[\s\S]*?'is-admin-route':\s*activeMenu\s*===\s*'\/admin'/, '主内容区必须能识别后台路由')
assert.match(appContent, /\.app-main\.is-admin-route\s*\{[\s\S]*?padding:\s*0\s*!important;/, '手机端后台父级主内容区不得和后台内部安全边距叠加')
