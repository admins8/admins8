import request from './request'
import type { SiteConfigItem } from './types'

function encodeSiteConfigForTransport(item: { config_key: string; config_value: string }) {
  if (item.config_key !== 'analytics_code') return item
  const value = item.config_value || ''
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return { ...item, config_value: `__BASE64__:${btoa(binary)}` }
}

export const configApi = {
  getConfig(key: string) {
    return request.get<any, { config_key: string; config_value: string }>(`/config/${key}`)
  },
  getAllConfigs() {
    return request.get<any, SiteConfigItem[]>('/config')
  },
  getPublicConfigs() {
    return request.get<any, SiteConfigItem[]>('/config/public/all')
  },
  updateConfig(data: { config_key: string; config_value: string }) {
    return request.put<any, void>('/config', encodeSiteConfigForTransport(data))
  },
  updateConfigs(configs: { config_key: string; config_value: string }[]) {
    return request.put<any, void>('/config/batch', configs.map(encodeSiteConfigForTransport))
  },
  testEmail(data: { to: string }) {
    return request.post<any, void>('/config/email/test', data)
  },
  testProxy(data: { proxy: string; userAgents?: string }) {
    return request.post<any, {
      ok: boolean
      total: number
      available: number
      results: Array<{
        ok: boolean
        proxy: string
        targetUrl: string
        status?: number
        elapsedMs?: number
        outboundIp?: string
        userAgent?: string
        error?: string
        message?: string
      }>
    }>('/config/proxy/test', data)
  },
}
