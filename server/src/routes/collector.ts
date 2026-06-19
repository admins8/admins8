import { Router } from 'express';
import {
  listPlugins,
  updatePluginStatus,
  getCollectorRules,
  upsertCollectorRule,
  removeCollectorRule,
  runCollectorRule,
  testRule,
  importRules,
  exportRules,
  getCollectorLogs,
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
router.post('/collector/test-rule', testRule);

export default router;
