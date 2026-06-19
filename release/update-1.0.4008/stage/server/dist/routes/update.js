"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const updateController_1 = require("../controllers/updateController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 升级相关接口仅超级管理员可操作
router.use(auth_1.authMiddleware, auth_1.superAdminMiddleware);
router.get('/version', updateController_1.getVersion);
router.get('/check', updateController_1.check);
router.post('/download', updateController_1.download);
router.post('/upload', updateController_1.uploadUpdateMiddleware, updateController_1.uploadPackage);
router.post('/install', updateController_1.install);
router.get('/history', updateController_1.history);
router.post('/rollback', updateController_1.rollback);
exports.default = router;
//# sourceMappingURL=update.js.map