import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(currentDir, 'HomeView.vue'), 'utf-8')

describe('首页人气榜样式', () => {
  it('人气榜入口不使用卡片底背景和外框', () => {
    const match = source.match(/\.ranking-entry\s*\{([\s\S]*?)\n\}/)

    const topLevelDeclarations = match?.[1].split('.ranking-entry-header')[0] || ''

    expect(topLevelDeclarations).toBeTruthy()
    expect(topLevelDeclarations).not.toContain('background:')
    expect(topLevelDeclarations).not.toContain('border:')
  })

  it('人气榜标题下方保留分隔线', () => {
    const match = source.match(/\.ranking-entry-header\s*\{([\s\S]*?)\n\s*\.column-title\.no-border/)
    const declarations = match?.[1] || ''

    expect(declarations).toContain('border-bottom:')
    expect(declarations).toContain('var(--el-color-primary-light-8)')
    expect(declarations).toContain('padding-bottom:')
  })
})
