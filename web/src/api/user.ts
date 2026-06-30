import request from './request'
import type { CheckinStatus, CheckinMonth } from './types'

export const userApi = {
  getCheckinStatus() {
    return request.get<any, CheckinStatus>('/user/checkin-status')
  },
  getCheckinMonth(month?: string) {
    const query = month ? `?month=${encodeURIComponent(month)}` : ''
    return request.get<any, CheckinMonth>(`/user/checkin-month${query}`)
  },
  checkin() {
    return request.post<any, CheckinStatus>('/user/checkin')
  },
}
