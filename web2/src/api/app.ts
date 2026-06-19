import request from './request'

export interface AppConfig {
  id: number
  app_name: string
  app_package: string
  api_base_url: string
  theme_color: string
  about_content: string
  privacy_policy_url: string
  user_agreement_url: string
  icon_path: string
  splash_path: string
}

export interface AppVersion {
  id: number
  platform: 'android' | 'harmony'
  version_name: string
  version_code: number
  changelog: string
  download_url: string
  force_update: boolean
  is_published: boolean
  file_size: number
  created_at: string
}

export interface BuildTask {
  id: number
  platform: 'android' | 'harmony'
  version_name: string
  version_code: number
  status: 'pending' | 'building' | 'success' | 'failed'
  build_log: string
  output_path: string
  created_at: string
}

export const appApi = {
  getAppConfig() {
    return request.get<any, AppConfig>('/app/admin/config')
  },
  updateAppConfig(data: Partial<AppConfig>) {
    return request.post<any, AppConfig>('/app/admin/config', data)
  },
  uploadAppIcon(file: File) {
    const formData = new FormData()
    formData.append('icon', file)
    return request.post<any, { icon_path: string }>('/app/admin/upload-icon', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadAppSplash(file: File) {
    const formData = new FormData()
    formData.append('splash', file)
    return request.post<any, { splash_path: string }>('/app/admin/upload-splash', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  listAppVersions(platform?: string) {
    return request.get<any, AppVersion[]>('/app/admin/versions', { params: { platform } })
  },
  createAppVersion(data: Partial<AppVersion>) {
    return request.post<any, AppVersion>('/app/admin/versions', data)
  },
  updateAppVersion(id: number, data: Partial<AppVersion>) {
    return request.put<any, AppVersion>(`/app/admin/versions/${id}`, data)
  },
  deleteAppVersion(id: number) {
    return request.delete<any, void>(`/app/admin/versions/${id}`)
  },
  triggerBuild(data: { platform: string; version_name: string; version_code: number; version_id: number }) {
    return request.post<any, BuildTask>('/app/admin/build', data)
  },
  getBuildStatus(id: number) {
    return request.get<any, BuildTask>(`/app/admin/build/${id}`)
  },
  listBuildTasks() {
    return request.get<any, BuildTask[]>('/app/admin/build-tasks')
  },
}
