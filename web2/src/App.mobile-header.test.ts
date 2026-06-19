import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const appVue = readFileSync(resolve(currentDir, 'App.vue'), 'utf-8')

describe('手机端顶部导航布局', () => {
  it('手机和平板把 logo 和登录区放在第一排，导航菜单放在第二排', () => {
    expect(appVue).toContain('@media (max-width: 1024px)')
    expect(appVue).toContain('order: 1;')
    expect(appVue).toContain('order: 2;')
    expect(appVue).toContain('order: 3;')
    expect(appVue).toContain('grid-template-columns: repeat(4, 1fr);')
  })

  it('手机和平板主内容区全局统一自适应宽度和高度', () => {
    expect(appVue).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.app-container\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*100vw;[^}]*overflow-x:\s*hidden;/)
    expect(appVue).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.app-main\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*100vw;[^}]*min-height:\s*calc\(100dvh\s*-\s*128px\);[^}]*overflow-x:\s*hidden;/)
    expect(appVue).toContain('box-sizing: border-box;')
  })
})
