import request from './request'

export interface BaiduPushConfig {
  enabled: boolean
  site_url: string
  daily_limit: number
  token: string
}

export interface BaiduPushLog {
  id: number
  type: string
  urls: string
  submitted: number
  success: number
  remaining: number
  status: string
  created_at: string
}

export interface BaiduPushResult {
  ok: boolean
  urlCount: number
  success: number
  remain?: number
  error?: string
}

export const baiduPushApi = {
  getConfig() {
    return request.get<any, BaiduPushConfig>('/admin/plugins/baidu-push/config')
  },
  updateConfig(data: Partial<BaiduPushConfig>) {
    return request.post<any, BaiduPushConfig>('/admin/plugins/baidu-push/config', data)
  },
  pushUrls(urls: string[]) {
    return request.post<any, { submitted: number; success: number; remaining: number }>('/admin/plugins/baidu-push/push', { urls })
  },
  pushSitemap(limit?: number) {
    return request.post<any, { submitted: number; success: number; remaining: number }>('/admin/plugins/baidu-push/sitemap', { limit })
  },
  getLogs(page?: number, pageSize?: number) {
    return request.get<any, { list: BaiduPushLog[]; total: number }>('/admin/plugins/baidu-push/logs', { params: { page, size: pageSize } })
  },
}
