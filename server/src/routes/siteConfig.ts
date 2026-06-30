import { Router } from 'express';
import { getAllConfigs, getConfig, updateConfig, updateConfigs, testEmailConfig } from '../controllers/siteConfigController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// 公开接口（首页展示用）
router.get('/public/all', getAllConfigs);
router.get('/:key', getConfig);

// 管理接口（需要管理员权限）
router.use(authMiddleware, adminMiddleware);
router.get('/', getAllConfigs);
router.put('/', updateConfig);
router.put('/batch', updateConfigs);
router.post('/email/test', testEmailConfig);

export default router;
