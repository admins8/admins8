import { Router } from 'express';
import {
  getVersion,
  check,
  download,
  uploadPackage,
  uploadUpdateMiddleware,
  install,
  history,
  rollback,
} from '../controllers/updateController';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';

const router = Router();

// 升级相关接口仅超级管理员可操作
router.use(authMiddleware, superAdminMiddleware);

router.get('/version', getVersion);
router.get('/check', check);
router.post('/download', download);
router.post('/upload', uploadUpdateMiddleware, uploadPackage);
router.post('/install', install);
router.get('/history', history);
router.post('/rollback', rollback);

export default router;
