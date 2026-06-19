import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, 'FemaleChannel.vue'), 'utf-8')

describe('手机版女频幻灯片比例', () => {
  it('手机版幻灯片使用 16:9 自适应比例', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*1220px\)[\s\S]*\.slider-panel,\s*\.slider-card\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;[^}]*height:\s*auto;/)
  })

  it('幻灯片图片铺满容器，标题固定在左下角', () => {
    expect(source).toMatch(/\.slider-card\s*\{[\s\S]*img\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;[^}]*object-position:\s*center center;/)
    expect(source).toMatch(/\.slider-overlay\s*\{[^}]*left:\s*44px;[^}]*top:\s*auto;[^}]*bottom:\s*38px;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1220px\)[\s\S]*\.slider-overlay\s*\{[^}]*left:\s*14px;[^}]*bottom:\s*12px;[^}]*width:\s*calc\(100%\s*-\s*28px\);/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1220px\)[\s\S]*\.slider-dots\s*\{[^}]*left:\s*auto;[^}]*right:\s*14px;[^}]*bottom:\s*12px;/)
  })
})
