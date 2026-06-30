import { Router } from 'express';
import {
  listPlugins,
  updatePluginStatus,
  getCollectorRules,
  upsertCollectorRule,
  removeCollectorRule,
  runCollectorRule,
  runBatchCollectorRule,
  runBatchCollectorSSE,
  testRule,
  testListPage,
  importRules,
  exportRules,
  getCollectorLogs,
  getSchedule,
  saveSchedule,
  removeSchedule,
} from '../controllers/collectorPluginController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// 所有接口都需要管理员权限
router.use(authMiddleware, adminMiddleware);

// 插件列表和状态
router.get('/plugins', listPlugins);
router.post('/plugins/status', updatePluginStatus);

// 采集规则 CRUD
router.get('/collector/rules', getCollectorRules);
router.post('/collector/rules/save', upsertCollectorRule);
router.post('/collector/rules/delete', removeCollectorRule);
router.post('/collector/import', importRules);
router.get('/collector/export', exportRules);
router.get('/collector/logs', getCollectorLogs);

// 采集操作
router.post('/collector/run-single', runCollectorRule);
router.post('/collector/run-batch', runBatchCollectorRule);
router.get('/collector/run-batch-sse', runBatchCollectorSSE);
router.post('/collector/test-rule', testRule);
router.post('/collector/test-list-page', testListPage);

// 定时任务
router.get('/collector/schedules', getSchedule);
router.post('/collector/schedules/save', saveSchedule);
router.post('/collector/schedules/delete', removeSchedule);

export default router;
