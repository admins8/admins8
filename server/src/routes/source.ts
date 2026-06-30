import { Router } from 'express';
import {
  getSources, getSource, addSource, updateSource, deleteSources, getSourceGroups, importFromUrl,
  getValidationSchedule, updateValidationSchedule, runValidationScheduleNow,
  dedupeSources, validateSource, validateStream,
  getExploreKinds, exploreSource, getExploreEnabledSources,
  getSourceLoginUi, loginSource, checkSourceLoginStatusApi,
} from '../controllers/sourceController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getSources);
router.get('/groups', getSourceGroups);

// 定时验证（必须在 /:id 之前）
router.get('/validation-schedule', getValidationSchedule);
router.put('/validation-schedule', updateValidationSchedule);
router.post('/validation-schedule/run', runValidationScheduleNow);

// 去重和验证（必须在 /:id 之前）
router.post('/dedupe', dedupeSources);
router.post('/validate', validateSource);
router.post('/validate-stream', validateStream);

// 发现/目录站功能（必须在 /:id 之前）
router.get('/explore-enabled', getExploreEnabledSources);
router.get('/:id/explore-kinds', getExploreKinds);
router.get('/:id/explore', exploreSource);

// 书源登录
router.get('/:id/login-ui', getSourceLoginUi);
router.post('/:id/login', loginSource);
router.get('/:id/login-status', checkSourceLoginStatusApi);

// 动态参数路由放最后
router.get('/:id', getSource);
router.post('/', addSource);
router.put('/:id', updateSource);
router.post('/delete', deleteSources);
router.post('/import-url', importFromUrl);

export default router;
