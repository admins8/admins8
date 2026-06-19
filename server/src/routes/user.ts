import { Router } from 'express';
import { checkin, getCheckinMonth, getCheckinStatus } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.get('/checkin-status', getCheckinStatus);
router.get('/checkin-month', getCheckinMonth);
router.post('/checkin', checkin);

export default router;
