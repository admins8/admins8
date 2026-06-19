import request from './request'

export const settingsApi = {
  getAppSettings() {
    return request.get<any, { legadoAppUrl: string }>('/book/app-settings')
  },
  setAppSettings(data: { legadoAppUrl: string }) {
    return request.post<any, void>('/book/app-settings', data)
  },
}
