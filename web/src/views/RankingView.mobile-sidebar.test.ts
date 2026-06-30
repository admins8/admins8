import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, 'RankingView.vue'), 'utf-8')

describe('手机和平板排行榜侧栏', () => {
  it('手机和平板隐藏排行总榜侧栏', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.ranking-sidebar\s*\{[^}]*display:\s*none;/)
  })

  it('手机和平板排行榜页面贴合屏幕宽度并压缩卡片留白', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.ranking-page\s*\{[^}]*width:\s*100vw;[^}]*margin-left:\s*-12px;[^}]*padding:\s*0;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.ranking-main\s*\{[^}]*border-radius:\s*0;[^}]*padding:\s*12px;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.rank-card\s*\{[^}]*padding:\s*12px;/)
  })
})
