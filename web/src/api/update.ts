import request from './request'
import type { ApiResult } from './types'

export interface UpdateRelease {
  version: string
  publishedAt: string
  url: string
  sigUrl: string
  changelog?: string
  minVersion?: string
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  current: string
  latest?: string
  release?: UpdateRelease
  reason?: string
}

export interface UpdateHistoryRecord {
  id: string
  operator?: string
  success: boolean
  fromVersion: string
  toVersion: string
  backupPath?: string
  error?: string
  rolledBack?: boolean
  startedAt: string
  finishedAt: string
}

export const updateApi = {
  async getVersion() {
    const res = await request.get<any, ApiResult<{ current: string; manifestUrl: string; online: boolean }>>('/admin/update/version')
    return res.data || res
  },
  async check() {
    const res = await request.get<any, ApiResult<UpdateCheckResult>>('/admin/update/check')
    return res.data || res
  },
  async download() {
    const res = await request.post<any, ApiResult<{ version: string; extractDir: string; zipPath: string }>>('/admin/update/download')
    return res.data || res
  },
  async install() {
    const res = await request.post<any, ApiResult<UpdateHistoryRecord>>('/admin/update/install')
    return res.data || res
  },
  async history() {
    const res = await request.get<any, ApiResult<UpdateHistoryRecord[]>>('/admin/update/history')
    return res.data || res
  },
  async rollback(backupPath: string) {
    const res = await request.post<any, ApiResult<UpdateHistoryRecord>>('/admin/update/rollback', { backupPath })
    return res.data || res
  },
  async upload(zipFile: File, signature: File | string) {
    const form = new FormData()
    form.append('package', zipFile)
    form.append('signature', typeof signature === 'string' ? signature : signature)
    const res = await request.post<any, ApiResult<{ version: string; extractDir: string }>>('/admin/update/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    })
    return res.data || res
  },
}
