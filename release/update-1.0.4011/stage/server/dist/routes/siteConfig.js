"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const siteConfigController_1 = require("../controllers/siteConfigController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 公开接口（首页展示用）
router.get('/public/all', siteConfigController_1.getAllConfigs);
router.get('/:key', siteConfigController_1.getConfig);
// 管理接口（需要管理员权限）
router.use(auth_1.authMiddleware, auth_1.adminMiddleware);
router.get('/', siteConfigController_1.getAllConfigs);
router.put('/', siteConfigController_1.updateConfig);
router.put('/batch', siteConfigController_1.updateConfigs);
router.post('/email/test', siteConfigController_1.testEmailConfig);
router.post('/proxy/test', siteConfigController_1.testProxyConfig);
exports.default = router;
//# sourceMappingURL=siteConfig.js.map