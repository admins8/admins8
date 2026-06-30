import { Router } from 'express';
import {
  getMembershipConfigs,
  createMembershipConfig,
  updateMembershipConfig,
  deleteMembershipConfig,
  getMemberStatus,
  createOrder,
  getOrders,
  getMyOrders,
  grantMembership,
  revokeMembership,
  getMemberList,
  getOrderStats,
} from '../controllers/memberController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// 前台接口（需登录）
router.get('/status', authMiddleware, getMemberStatus);
router.post('/order', authMiddleware, createOrder);
router.get('/my-orders', authMiddleware, getMyOrders);
router.get('/configs', getMembershipConfigs);

// 后台接口（需管理员权限）
router.use(authMiddleware, adminMiddleware);
router.get('/admin/configs', getMembershipConfigs);
router.post('/admin/configs', createMembershipConfig);
router.put('/admin/configs/:id', updateMembershipConfig);
router.delete('/admin/configs/:id', deleteMembershipConfig);
router.get('/admin/orders', getOrders);
router.post('/admin/grant', grantMembership);
router.post('/admin/revoke', revokeMembership);
router.get('/admin/members', getMemberList);
router.get('/admin/stats', getOrderStats);

export default router;
