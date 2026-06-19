import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, 'Reader.vue'), 'utf-8')

describe('手机和平板阅读页全屏阅读', () => {
  it('手机和平板进入阅读页默认隐藏功能栏，点击中间再显示', () => {
    expect(source).toContain('function isReaderCompactViewport()')
    expect(source).toMatch(/if\s*\(isReaderCompactViewport\(\)\)\s*\{[\s\S]*showHeader\.value\s*=\s*false/)
    expect(source).toContain('toggleHeader()')
  })

  it('手机和平板阅读容器全屏铺满，功能栏覆盖显示不挤压正文', () => {
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.reader-page\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*height:\s*100dvh;[^}]*width:\s*100vw;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.reader-header\s*\{[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*left:\s*0;[^}]*right:\s*0;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.reader-footer\s*\{[^}]*position:\s*fixed;[^}]*left:\s*0;[^}]*right:\s*0;[^}]*bottom:\s*0;/)
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.reader-content\s*\{[^}]*height:\s*100dvh;/)
  })

  it('提供浏览器原生全屏阅读按钮和兼容兜底', () => {
    expect(source).toContain('toggleNativeFullscreen')
    expect(source).toContain('requestFullscreen')
    expect(source).toContain('exitFullscreen')
    expect(source).toContain('fullscreenchange')
    expect(source).toContain('全屏阅读')
    expect(source).toContain('退出全屏')
    expect(source).toContain('当前浏览器不支持真正全屏')
  })

  it('支持屏幕常亮和 safe-area 安全区适配', () => {
    expect(source).toContain('requestWakeLock')
    expect(source).toContain('releaseWakeLock')
    expect(source).toContain('navigator.wakeLock.request')
    expect(source).toContain('visibilitychange')
    expect(source).toContain('保持屏幕常亮')
    expect(source).toContain('env(safe-area-inset-top)')
    expect(source).toContain('env(safe-area-inset-bottom)')
    expect(source).toContain('env(safe-area-inset-left)')
    expect(source).toContain('env(safe-area-inset-right)')
  })

  it('支持九宫格点击动作配置和阅读排版扩展设置', () => {
    expect(source).toContain('type TapZoneAction')
    expect(source).toContain('tapZoneActions')
    expect(source).toContain('getTapZoneKey')
    expect(source).toContain('runTapZoneAction')
    expect(source).toContain('菜单')
    expect(source).toContain('上一页/章')
    expect(source).toContain('下一页/章')
    expect(source).toContain('书签')
    expect(source).toContain('无动作')
    expect(source).toContain('字距')
    expect(source).toContain('段距')
    expect(source).toContain('首行缩进')
    expect(source).toContain('页边距')
    expect(source).toContain('标题显示')
    expect(source).toContain('页眉页脚')
  })

  it('关闭页眉页脚后点击中间仍能显示功能选项', () => {
    expect(source).toContain('showHeaderFooter')
    expect(source).toContain('handleHeaderFooterToggle')
    expect(source).toContain('function toggleHeader()')
    expect(source).not.toContain("reader-header\" :class=\"{ 'header-hidden': !showHeader || !readerSettings.showHeaderFooter }")
    expect(source).not.toContain("reader-footer\" :class=\"{ 'footer-hidden': !showHeader || !readerSettings.showHeaderFooter }")
  })
})
