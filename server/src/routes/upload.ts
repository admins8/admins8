import { Router } from 'express';
import { adminMiddleware, authMiddleware } from '../middleware/auth';
import { uploadImage, uploadImageMiddleware } from '../controllers/uploadController';

const router = Router();

router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  uploadImageMiddleware(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ code: 400, msg: err.message || '上传失败' });
      return;
    }
    uploadImage(req, res);
  });
});

export default router;
