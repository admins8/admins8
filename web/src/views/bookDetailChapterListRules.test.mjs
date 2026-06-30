import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(__dirname, 'BookDetail.vue'), 'utf8')

assert.doesNotMatch(
  source,
  /chapters\.value\.slice\(\s*0\s*,\s*60\s*\)/,
  '详情页目录不能固定截断为前 60 章，应显示完整目录'
)

assert.doesNotMatch(
  source,
  /v-for="chapter in previewChapters"/,
  '目录渲染不能使用只保留前 60 章的 previewChapters'
)

assert.match(
  source,
  /v-for="chapter in chapters"/,
  '目录应直接渲染完整 chapters 列表'
)
