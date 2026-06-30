import request from './request'
import type { ApiResponse, MembershipConfig, MemberOrder, MemberStatus } from './types'

export const memberApi = {
  // 前台接口
  getConfigs(): Promise<ApiResponse<MembershipConfig[]>> {
    return request.get('/member/configs')
  },
  getStatus(): Promise<ApiResponse<MemberStatus>> {
    return request.get('/member/status')
  },
  createOrder(product_type: string): Promise<ApiResponse<{ orderNo: string; amount: number; productName: string }>> {
    return request.post('/member/order', { product_type })
  },
  getMyOrders(page = 1, size = 20): Promise<ApiResponse<{ list: MemberOrder[]; total: number }>> {
    return request.get('/member/my-orders', { params: { page, size } })
  },

  // 后台接口
  getAdminConfigs(): Promise<ApiResponse<MembershipConfig[]>> {
    return request.get('/member/admin/configs')
  },
  createConfig(data: Partial<MembershipConfig>): Promise<ApiResponse<null>> {
    return request.post('/member/admin/configs', data)
  },
  updateConfig(id: number, data: Partial<MembershipConfig>): Promise<ApiResponse<null>> {
    return request.put(`/member/admin/configs/${id}`, data)
  },
  deleteConfig(id: number): Promise<ApiResponse<null>> {
    return request.delete(`/member/admin/configs/${id}`)
  },
  getAdminOrders(page = 1, size = 20): Promise<ApiResponse<{ list: MemberOrder[]; total: number }>> {
    return request.get('/member/admin/orders', { params: { page, size } })
  },
  grantMembership(userId: number, product_type: string): Promise<ApiResponse<null>> {
    return request.post('/member/admin/grant', { userId, product_type })
  },
  revokeMembership(userId: number): Promise<ApiResponse<null>> {
    return request.post('/member/admin/revoke', { userId })
  },
  getMemberList(page = 1, size = 20, keyword = ''): Promise<ApiResponse<{ list: any[]; total: number }>> {
    return request.get('/member/admin/members', { params: { page, size, keyword } })
  },
  getOrderStats(): Promise<ApiResponse<{ totalAmount: number; todayAmount: number; totalOrders: number; paidOrders: number }>> {
    return request.get('/member/admin/stats')
  },
}
