import request from './request'
import type { RankingItem, RankingGroupedResponse, RankTypeMeta, LocalLibraryResponse } from './types'

export const homeApi = {
  getHotSearches() {
    return request.get<any, { id: number; name: string; count: number; tag_type: string; sort_order: number }[]>('/home/searches')
  },
  getHotRankings(params?: { type?: string; category?: string; limit?: number }) {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.category) qs.set('category', params.category)
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return request.get<any, RankingItem[]>(`/home/rankings${q ? `?${q}` : ''}`)
  },
  getRankingsGrouped(category?: string, perRank?: number) {
    const qs = new URLSearchParams()
    if (category) qs.set('category', category)
    if (perRank) qs.set('perRank', String(perRank))
    const q = qs.toString()
    return request.get<any, RankingGroupedResponse>(`/home/rankings/grouped${q ? `?${q}` : ''}`)
  },
  getRankingMeta() {
    return request.get<any, { types: RankTypeMeta[]; categories: string[] }>('/home/rankings/meta')
  },
  getHotTags() {
    return request.get<any, { id: number; name: string; sort_order: number }[]>('/home/tags')
  },
  getLocalLibrary(params?: { keyword?: string; category?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams()
    if (params?.keyword) qs.set('keyword', params.keyword)
    if (params?.category) qs.set('category', params.category)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
    const q = qs.toString()
    return request.get<any, LocalLibraryResponse>(`/home/library${q ? `?${q}` : ''}`)
  },
  getAllHotSearches() {
    return request.get<any, any[]>('/home/searches/all')
  },
  addHotSearch(data: { name: string; count: number; tag_type: string; sort_order: number }) {
    return request.post<any, { id: number }>('/home/searches', data)
  },
  updateHotSearch(data: { id: number; name: string; count: number; tag_type: string; sort_order: number; is_active?: boolean }) {
    return request.put<any, void>('/home/searches', data)
  },
  deleteHotSearch(id: number) {
    return request.post<any, void>('/home/searches/delete', { id })
  },
  getAllHotRankings(params?: { type?: string; category?: string }) {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.category) qs.set('category', params.category)
    const q = qs.toString()
    return request.get<any, any[]>(`/home/rankings/all${q ? `?${q}` : ''}`)
  },
  refreshRankings() {
    return request.post<any, { inserted: number; sourceCount: number }>('/home/rankings/refresh', {})
  },
  addHotRanking(data: Record<string, any>) {
    return request.post<any, { id: number }>('/home/rankings', data)
  },
  updateHotRanking(data: Record<string, any> & { id: number }) {
    return request.put<any, void>('/home/rankings', data)
  },
  deleteHotRanking(id: number) {
    return request.post<any, void>('/home/rankings/delete', { id })
  },
  getAllHotTags() {
    return request.get<any, any[]>('/home/tags/all')
  },
  addHotTag(data: { name: string; sort_order: number }) {
    return request.post<any, { id: number }>('/home/tags', data)
  },
  updateHotTag(data: { id: number; name: string; sort_order: number; is_active?: boolean }) {
    return request.put<any, void>('/home/tags', data)
  },
  deleteHotTag(id: number) {
    return request.post<any, void>('/home/tags/delete', { id })
  },
}
