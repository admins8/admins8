import request from './request'
import type { ApiResult } from './types'

export interface PageChannelItem {
  id: number
  section_id: number
  title: string
  author?: string
  cover_url?: string
  intro?: string
  category?: string
  word_count?: string
  latest_chapter?: string
  link_url?: string
  sort_order: number
  is_active: number | boolean
}

export interface PageChannelSection {
  id: number
  channel_code: string
  section_code: string
  title: string
  display_type: string
  more_link?: string
  sort_order: number
  is_active: number | boolean
  items: PageChannelItem[]
}

export interface PageChannel {
  id: number
  code: string
  name: string
  path: string
  compat_path?: string
  seo_title?: string
  seo_keywords?: string
  seo_description?: string
  is_active: number | boolean
  sort_order: number
  sections: PageChannelSection[]
}

export interface ContentPage {
  id?: number
  slug: string
  title: string
  content: string
  seo_title?: string
  seo_keywords?: string
  seo_description?: string
  is_active: number | boolean
  sort_order?: number
}

export interface FriendlyLink {
  id?: number
  name: string
  url: string
  description?: string
  sort_order: number
  is_active: number | boolean
  start_at?: string | null
  end_at?: string | null
}

export const pageApi = {
  async getChannel(code: string) {
    const res = await request.get<any, ApiResult<PageChannel>>(`/pages/channels/${encodeURIComponent(code)}`)
    return res.data || res
  },
  async getContentPage(slug: string) {
    const res = await request.get<any, ApiResult<ContentPage>>(`/pages/content/${encodeURIComponent(slug)}`)
    return res.data || res
  },
  async getFriendlyLinks() {
    const res = await request.get<any, ApiResult<FriendlyLink[]>>('/pages/friendly-links')
    return res.data || res
  },
}

export const pageAdminApi = {
  async getChannel(code: string) {
    const res = await request.get<any, ApiResult<PageChannel | null>>(`/admin/pages/channels/${encodeURIComponent(code)}`)
    return res.data || res
  },
  async seedChannel(code: string) {
    const res = await request.post<any, ApiResult<PageChannel>>(`/admin/pages/channels/${encodeURIComponent(code)}/seed`)
    return res.data || res
  },
  async updateChannel(code: string, payload: Partial<PageChannel>) {
    const res = await request.put<any, ApiResult<PageChannel>>(`/admin/pages/channels/${encodeURIComponent(code)}`, payload)
    return res.data || res
  },
  async createSection(code: string, payload: Partial<PageChannelSection>) {
    const res = await request.post<any, ApiResult<PageChannelSection>>(`/admin/pages/channels/${encodeURIComponent(code)}/sections`, payload)
    return res.data || res
  },
  async updateSection(id: number, payload: Partial<PageChannelSection>) {
    const res = await request.put<any, ApiResult<PageChannelSection>>(`/admin/pages/sections/${id}`, payload)
    return res.data || res
  },
  async deleteSection(id: number) {
    const res = await request.post<any, ApiResult<{ id: number }>>('/admin/pages/sections/delete', { id })
    return res.data || res
  },
  async createItem(sectionId: number, payload: Partial<PageChannelItem>) {
    const res = await request.post<any, ApiResult<PageChannelItem>>(`/admin/pages/sections/${sectionId}/items`, payload)
    return res.data || res
  },
  async updateItem(id: number, payload: Partial<PageChannelItem>) {
    const res = await request.put<any, ApiResult<PageChannelItem>>(`/admin/pages/items/${id}`, payload)
    return res.data || res
  },
  async deleteItem(id: number) {
    const res = await request.post<any, ApiResult<{ id: number }>>('/admin/pages/items/delete', { id })
    return res.data || res
  },
  async listContentPages() {
    const res = await request.get<any, ApiResult<ContentPage[]>>('/admin/pages/content-pages')
    return res.data || res
  },
  async getContentPage(slug: string) {
    const res = await request.get<any, ApiResult<ContentPage>>(`/admin/pages/content-pages/${encodeURIComponent(slug)}`)
    return res.data || res
  },
  async updateContentPage(slug: string, payload: Partial<ContentPage>) {
    const res = await request.put<any, ApiResult<ContentPage>>(`/admin/pages/content-pages/${encodeURIComponent(slug)}`, payload)
    return res.data || res
  },
  async listFriendlyLinks() {
    const res = await request.get<any, ApiResult<{ links: FriendlyLink[], settings: { enabled: boolean } }>>('/admin/pages/friendly-links')
    return res.data || res
  },
  async updateFriendlyLinkSettings(enabled: boolean) {
    const res = await request.put<any, ApiResult<{ enabled: boolean }>>('/admin/pages/friendly-links/settings', { enabled })
    return res.data || res
  },
  async createFriendlyLink(payload: Partial<FriendlyLink>) {
    const res = await request.post<any, ApiResult<FriendlyLink>>('/admin/pages/friendly-links', payload)
    return res.data || res
  },
  async updateFriendlyLink(id: number, payload: Partial<FriendlyLink>) {
    const res = await request.put<any, ApiResult<FriendlyLink>>(`/admin/pages/friendly-links/${id}`, payload)
    return res.data || res
  },
  async deleteFriendlyLink(id: number) {
    const res = await request.post<any, ApiResult<boolean>>('/admin/pages/friendly-links/delete', { id })
    return res.data || res
  },
}
