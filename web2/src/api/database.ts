import request from './request'
import type { ApiResult } from './types'

export interface DatabaseTableInfo {
  name: string
  engine: string
  rows: number
  dataSizeKB: number
  indexSizeKB: number
  totalSizeKB: number
  collation: string | null
  createTime: string | null
  updateTime: string | null
}

export interface DatabaseBackupFile {
  fileName: string
  sizeKB: number
  createdAt: string
}

export interface DatabaseOperateResult {
  table: string
  operation: 'optimize' | 'repair'
  status: 'OK' | 'warning' | 'error'
  message: string
  durationMs: number
}

export const databaseApi = {
  async getTables() {
    const res = await request.get<any, ApiResult<{ totalSizeKB: number; tables: DatabaseTableInfo[] }>>('/admin/database/tables')
    return res.data || res
  },
  async backupAll() {
    const res = await request.post<any, ApiResult<{ fileName: string; sizeKB: number; tables: number }>>('/admin/database/backup')
    return res.data || res
  },
  async backupTable(table: string) {
    const res = await request.post<any, ApiResult<{ fileName: string; sizeKB: number; rows: number }>>(`/admin/database/backup/${encodeURIComponent(table)}`)
    return res.data || res
  },
  async getBackups() {
    const res = await request.get<any, ApiResult<{ totalSizeKB: number; files: DatabaseBackupFile[] }>>('/admin/database/backups')
    return res.data || res
  },
  async restore(file: string) {
    const res = await request.post<any, ApiResult<{ success: true; sizeKB: number }>>('/admin/database/restore', { file })
    return res.data || res
  },
  async deleteBackup(file: string) {
    const res = await request.post<any, ApiResult<{ file: string }>>('/admin/database/backups/delete', { file })
    return res.data || res
  },
  async optimize(tables: string[]) {
    const res = await request.post<any, ApiResult<DatabaseOperateResult[]>>('/admin/database/optimize', { tables })
    return res.data || res
  },
  async repair(tables: string[]) {
    const res = await request.post<any, ApiResult<DatabaseOperateResult[]>>('/admin/database/repair', { tables })
    return res.data || res
  },
}
