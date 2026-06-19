"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const collectorPluginController_1 = require("../controllers/collectorPluginController");
const router = (0, express_1.Router)();
// 所有接口都需要管理员权限
router.use(auth_1.authMiddleware, auth_1.adminMiddleware);
// 仪表盘统计（admin和superadmin都可访问）
router.get('/stats', adminController_1.getStats);
router.get('/books', adminController_1.getAllBooks);
router.post('/books/delete', adminController_1.deleteBook);
router.post('/books/dedupe', adminController_1.dedupeBooks);
router.post('/books/auto-dedupe-interval', adminController_1.setAutoDedupeInterval);
router.get('/book-categories', adminController_1.getBookCategories);
router.post('/book-categories/create', adminController_1.createBookCategory);
router.post('/book-categories/update', adminController_1.updateBookCategory);
router.post('/book-categories/delete', adminController_1.deleteBookCategory);
// 插件管理与采集插件
router.get('/plugins', collectorPluginController_1.listPlugins);
router.post('/plugins/status', collectorPluginController_1.updatePluginStatus);
router.get('/collector/rules', collectorPluginController_1.getCollectorRules);
router.post('/collector/rules/save', collectorPluginController_1.upsertCollectorRule);
router.post('/collector/rules/delete', collectorPluginController_1.removeCollectorRule);
router.post('/collector/run-single', collectorPluginController_1.runCollectorRule);
router.post('/collector/test-rule', collectorPluginController_1.testRule);
router.post('/collector/import', collectorPluginController_1.importRules);
router.get('/collector/export', collectorPluginController_1.exportRules);
router.get('/collector/logs', collectorPluginController_1.getCollectorLogs);
router.get('/baidu-push/config', collectorPluginController_1.getBaiduPushConfig);
router.post('/baidu-push/config', collectorPluginController_1.saveBaiduPushConfig);
router.post('/baidu-push/push-urls', collectorPluginController_1.pushBaiduUrls);
router.post('/baidu-push/push-sitemap', collectorPluginController_1.pushBaiduSitemap);
router.get('/baidu-push/logs', collectorPluginController_1.getBaiduPushLogs);
// 用户管理（仅superadmin可访问）
router.get('/users', auth_1.superAdminMiddleware, adminController_1.getUsers);
router.post('/users/status', auth_1.superAdminMiddleware, adminController_1.updateUserStatus);
router.post('/users/password', auth_1.superAdminMiddleware, adminController_1.updateUserPassword);
router.post('/users/create', auth_1.superAdminMiddleware, adminController_1.createUser);
router.post('/users/delete', auth_1.superAdminMiddleware, adminController_1.deleteUser);
router.post('/users/permissions', auth_1.superAdminMiddleware, adminController_1.updateUserPermissions);
router.get('/user-records/:type', auth_1.superAdminMiddleware, adminController_1.getUserRecords);
exports.default = router;
//# sourceMappingURL=admin.js.map