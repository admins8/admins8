import { Router } from 'express';
import {
  getPaymentConfigs,
  getPaymentConfig,
  savePaymentConfig,
  deletePaymentConfig,
  wechatNotify,
  alipayNotify,
} from '../controllers/paymentController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// 支付回调（无需认证）
router.post('/notify/wechat', wechatNotify);
router.post('/notify/alipay', alipayNotify);

// 后台接口（需管理员权限）
router.use(authMiddleware, adminMiddleware);
router.get('/configs', getPaymentConfigs);
router.get('/configs/:channel', getPaymentConfig);
router.post('/configs', savePaymentConfig);
router.delete('/configs/:channel', deletePaymentConfig);

export default router;
