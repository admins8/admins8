import { describe, expect, it } from 'vitest'
import { renderSeoTemplate } from './seo'

describe('renderSeoTemplate', () => {
  it('SEO 模板会自动渲染 {年份} 为当前年份', () => {
    const year = String(new Date().getFullYear())

    const output = renderSeoTemplate('{siteName}_{年份}_{bookName}', {
      siteName: '搜书网',
      bookName: '仙工开物',
    })

    expect(output).toBe(`搜书网_${year}_仙工开物`)
  })

  it('SEO 模板支持中文变量名和英文变量名同时渲染', () => {
    const output = renderSeoTemplate('{书名}_{bookName}_{作者}_{author}', {
      bookName: '仙工开物',
      author: '蛊真人',
    })

    expect(output).toBe('仙工开物_仙工开物_蛊真人_蛊真人')
  })
})
