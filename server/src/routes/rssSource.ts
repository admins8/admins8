import { Router } from 'express';
import {
  getRssArticles,
  getRssContent,
  getRssSources,
  importRssSourceUrl,
  putRssSource,
  removeRssSources,
} from '../controllers/rssSourceController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/', getRssSources);
router.post('/import-url', rateLimit(60000, 3), importRssSourceUrl);
router.put('/:id', putRssSource);
router.post('/delete', removeRssSources);
router.get('/:id/articles', rateLimit(60000, 20), getRssArticles);
router.get('/:id/content', rateLimit(60000, 60), getRssContent);

export default router;
