import request from './request'

export interface Advertisement {
  id: number
  position: string
  title: string
  image_url: string
  link_url: string
  content: string
  ad_type: 'image' | 'text' | 'html'
  target: string
  sort_order: number
  popup_interval_seconds?: number
  popup_auto_close_seconds?: number
  start_time: string | null
  end_time: string | null
  is_active: boolean | number
  remark: string
  created_at?: string
  updated_at?: string
}

export const adApi = {
  getAdsByPosition(position: string) {
    return request.get<any, Advertisement[]>(`/ads/list?position=${encodeURIComponent(position)}`)
  },
  getAllAds(position?: string) {
    const url = position ? `/ads/all?position=${encodeURIComponent(position)}` : '/ads/all'
    return request.get<any, Advertisement[]>(url)
  },
  addAd(data: Partial<Advertisement>) {
    return request.post<any, { id: number }>('/ads', data)
  },
  updateAd(data: Partial<Advertisement> & { id: number }) {
    return request.put<any, void>('/ads', data)
  },
  deleteAd(id: number) {
    return request.post<any, void>('/ads/delete', { id })
  },
}
