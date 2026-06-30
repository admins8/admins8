import request from './request'
import type { ApiResponse, PaymentConfig } from './types'

export const paymentApi = {
  getConfigs(): Promise<ApiResponse<PaymentConfig[]>> {
    return request.get('/payment/configs')
  },
  getConfig(channel: string): Promise<ApiResponse<PaymentConfig | null>> {
    return request.get(`/payment/configs/${channel}`)
  },
  saveConfig(data: Partial<PaymentConfig>): Promise<ApiResponse<null>> {
    return request.post('/payment/configs', data)
  },
  deleteConfig(channel: string): Promise<ApiResponse<null>> {
    return request.delete(`/payment/configs/${channel}`)
  },
}
