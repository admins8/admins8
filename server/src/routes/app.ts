import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as appController from '../controllers/appController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// 文件上传配置 - 使用与后端静态服务一致的目录
const uploadsDir = path.resolve(__dirname, '../../data/uploads/app');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'app-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 公开API
router.get('/config', appController.getPublicConfig);
router.get('/check-update', appController.checkUpdate);
router.post('/build-callback', appController.buildCallback);

// 管理员API
router.get('/admin/config', authMiddleware, adminMiddleware, appController.getConfig);
router.post('/admin/config', authMiddleware, adminMiddleware, appController.updateConfig);
router.put('/admin/config', authMiddleware, adminMiddleware, appController.updateConfig);
router.post('/admin/upload-icon', authMiddleware, adminMiddleware, upload.single('icon'), appController.uploadIcon);
router.post('/admin/upload-splash', authMiddleware, adminMiddleware, upload.single('splash'), appController.uploadSplash);

router.get('/admin/versions', authMiddleware, adminMiddleware, appController.listVersions);
router.post('/admin/versions', authMiddleware, adminMiddleware, appController.createVersion);
router.put('/admin/versions/:id', authMiddleware, adminMiddleware, appController.updateVersion);
router.delete('/admin/versions/:id', authMiddleware, adminMiddleware, appController.deleteVersion);

router.post('/admin/build', authMiddleware, adminMiddleware, appController.triggerBuild);
router.get('/admin/build/:id', authMiddleware, adminMiddleware, appController.getBuildStatus);
router.get('/admin/build-tasks', authMiddleware, adminMiddleware, appController.listBuildTasks);

export default router;
