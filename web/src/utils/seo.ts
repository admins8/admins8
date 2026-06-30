import { setMetaTag, type SiteConfigMap } from './siteConfig'

export type SeoTemplateVars = Record<string, string | number | undefined | null>

export const defaultSeoTemplates = {
  home_title: '{siteName}',
  home_keywords: '小说,免费小说,网络小说,小说搜索,{年份}',
  home_description: '{siteName}提供热门小说搜索、在线阅读和排行榜推荐。',

  detail_title_template: '{bookName}全文免费阅读_{bookName}最新章节_{siteName}',
  detail_keywords_template: '{bookName},{author},{bookName}最新章节,{bookName}全文阅读,{年份}',
  detail_description_template: '{bookName}是{author}创作的小说，最新章节：{latestChapter}。{intro}',

  reader_title_template: '{chapterTitle}_{bookName}全文阅读_{siteName}',
  reader_keywords_template: '{bookName},{chapterTitle},{author},免费阅读,{年份}',
  reader_description_template: '正在阅读{bookName}的{chapterTitle}，作者：{author}。',

  search_title_template: '{keyword}搜索结果_{siteName}',
  search_keywords_template: '{keyword},小说搜索,免费小说,{年份}',
  search_description_template: '在{siteName}搜索{keyword}，查看相关小说和可用书源。',

  ranking_title_template: '小说排行榜_{siteName}',
  ranking_keywords_template: '小说排行榜,热门小说,完本小说,免费小说,{年份}',
  ranking_description_template: '{siteName}提供热门小说排行榜、分类榜单和推荐书单。',
}

const varAliases: Record<string, string> = {
  网站名: 'siteName',
  年份: 'year',
  书名: 'bookName',
  作者: 'author',
  简介: 'intro',
  分类: 'category',
  最新章节: 'latestChapter',
  章节名: 'chapterTitle',
  书源: 'sourceName',
  关键词: 'keyword',
  榜单名: 'rankName',
}

export function renderSeoTemplate(template: string, vars: SeoTemplateVars = {}) {
  const year = String(new Date().getFullYear())
  const values: SeoTemplateVars = {
    siteName: '搜书网',
    year,
    ...vars,
  }

  return String(template || '').replace(/\{([^{}]+)\}/g, (_, rawKey: string) => {
    const key = varAliases[rawKey] || rawKey
    const value = key === 'year' ? year : values[key]
    return String(value ?? '').trim()
  })
}

export function applySeo(configs: SiteConfigMap, fields: {
  titleKey: string
  keywordsKey: string
  descriptionKey: string
  fallbackTitle: string
  fallbackKeywords?: string
  fallbackDescription?: string
}, vars: SeoTemplateVars = {}) {
  const siteName = configs.site_title || '搜书网'
  const mergedVars = { siteName, ...vars }
  const title = renderSeoTemplate(configs[fields.titleKey] || fields.fallbackTitle, mergedVars)
  const keywords = renderSeoTemplate(configs[fields.keywordsKey] || fields.fallbackKeywords || '', mergedVars)
  const description = renderSeoTemplate(configs[fields.descriptionKey] || fields.fallbackDescription || '', mergedVars)

  document.title = title || siteName
  setMetaTag('keywords', keywords)
  setMetaTag('description', description)

  return { title, keywords, description }
}
