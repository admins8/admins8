import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, 'BookDetail.vue'), 'utf-8')

describe('手机和平板详情页自适应', () => {
  it('手机和平板详情页宽度贴合屏幕并隐藏侧栏', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.book-detail-page\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*100vw;[^}]*margin-left:\s*-12px;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.author-card,\s*\.rank-side\s*\{[^}]*display:\s*none;/)
  })

  it('手机和平板封面、信息区、按钮和目录自适应宽高', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.book-cover,\s*\.cover-placeholder\s*\{[^}]*width:\s*clamp\(96px,\s*22vw,\s*132px\);[^}]*height:\s*clamp\(134px,\s*31vw,\s*184px\);/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.book-info\s*\{[^}]*min-width:\s*0;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.actions\s*\{[^}]*flex-wrap:\s*wrap;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.chapter-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/)
  })

  it('小屏详情页改为上下布局，按钮和目录单列铺满', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*\.hero-card\s*\{[^}]*grid-template-columns:\s*1fr;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*\.cover-wrap\s*\{[^}]*justify-content:\s*center;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*\.actions\s*:deep\(\.el-button\)\s*\{[^}]*width:\s*100%;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*\.chapter-grid\s*\{[^}]*grid-template-columns:\s*1fr;/)
  })
})
