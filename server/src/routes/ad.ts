import { Router } from 'express';
import {
  getAdsByPosition,
  getAllAds,
  addAd,
  updateAd,
  deleteAd,
} from '../controllers/adController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// 公开接口：按位置获取启用中的广告
router.get('/list', getAdsByPosition);

// 管理接口
router.use(authMiddleware, adminMiddleware);
router.get('/all', getAllAds);
router.post('/', addAd);
router.put('/', updateAd);
router.post('/delete', deleteAd);

export default router;
