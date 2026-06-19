import request from './request'

export interface RssSource {
  id: number
  source_url: string
  source_name: string
  source_group?: string
  source_icon?: string
  source_comment?: string
  enabled: number | boolean
  custom_order: number
  article_style?: number
  sort_url?: string
}

export interface RssArticle {
  index: number
  title: string
  link: string
  image?: string
  pubDate?: string
}

export const rssSourceApi = {
  getSources() {
    return request.get<any, RssSource[]>('/rss-sources')
  },
  importFromUrl(url: string) {
    return request.post<any, { success: number; fail: number; results: any[] }>('/rss-sources/import-url', { url })
  },
  updateSource(id: number, data: Partial<RssSource>) {
    return request.put<any, void>(`/rss-sources/${id}`, data)
  },
  deleteSources(ids: number[]) {
    return request.post<any, void>('/rss-sources/delete', { ids })
  },
  getArticles(id: number, url?: string) {
    const params = url ? `?url=${encodeURIComponent(url)}` : ''
    return request.get<any, { source: RssSource; items: RssArticle[] }>(`/rss-sources/${id}/articles${params}`)
  },
  getContent(id: number, link: string) {
    return request.get<any, { source: RssSource; link: string; content: string }>(`/rss-sources/${id}/content?link=${encodeURIComponent(link)}`)
  },
}
