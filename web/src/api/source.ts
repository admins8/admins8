import request from './request'
import type { BookSource } from './types'

export interface ValidateSourceResult {
  id: number
  ok: boolean
  sampleCount: number
  respondTime: number
  message: string
}

export interface SourceValidationLastResult {
  total: number
  okCount: number
  failCount: number
  disabledCount: number
  deletedCount: number
  message: string
}

export interface SourceValidationScheduleSettings {
  enabled: boolean
  day: number
  hour: number
  minute: number
  keyword: string
  timeoutMs: number
  concurrency: number
  scope: 'enabled' | 'all' | 'failed'
  failureAction: 'none' | 'disable' | 'delete'
  lastRunKey: string
  lastRunAt: string
  lastResult: SourceValidationLastResult
}

export const sourceApi = {
  getSources() {
    return request.get<any, BookSource[]>('/sources')
  },
  updateSource(id: string, data: Partial<BookSource>) {
    return request.put<any, BookSource>(`/sources/${id}`, data)
  },
  deleteSources(ids: string[]) {
    return request.post<any, void>('/sources/delete', { ids })
  },
  dedupeSources() {
    return request.post<any, { removed: number; ids: number[] }>('/sources/dedupe', {})
  },
  getSourceGroups() {
    return request.get<any, string[]>('/sources/groups')
  },
  importSourcesFromUrl(url: string) {
    return request.post<any, { success: number; fail: number; failedNames?: string[] }>('/sources/import-url', { url })
  },
  validateSource(id: number, keyword?: string) {
    return request.post<any, ValidateSourceResult>('/sources/validate', { id, keyword })
  },
  getValidationSchedule() {
    return request.get<any, SourceValidationScheduleSettings>('/sources/validation-schedule')
  },
  updateValidationSchedule(data: Partial<SourceValidationScheduleSettings>) {
    return request.put<any, SourceValidationScheduleSettings>('/sources/validation-schedule', data)
  },
  runValidationScheduleNow() {
    return request.post<any, { result: SourceValidationLastResult; settings: SourceValidationScheduleSettings }>('/sources/validation-schedule/run')
  },
}
