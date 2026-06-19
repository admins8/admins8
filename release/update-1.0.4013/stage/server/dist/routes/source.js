"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sourceController_1 = require("../controllers/sourceController");
const auth_1 = require("../middleware/auth");
const permissionService_1 = require("../services/permissionService");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, (0, auth_1.permissionMiddleware)(permissionService_1.PERMISSIONS.SOURCE_MANAGE));
router.get('/', sourceController_1.getSources);
router.get('/groups', sourceController_1.getSourceGroups);
router.get('/validation-schedule', sourceController_1.getValidationSchedule);
router.put('/validation-schedule', sourceController_1.updateValidationSchedule);
router.post('/validation-schedule/run', (0, rateLimit_1.rateLimit)(60000, 2), sourceController_1.runValidationScheduleNow);
// 验证接口限流：每 IP 每 60 秒最多 5 次
router.get('/validate-stream', (0, rateLimit_1.rateLimit)(60000, 5), sourceController_1.validateSourcesStream); // SSE，前端用 EventSource
router.post('/validate-stream', (0, rateLimit_1.rateLimit)(60000, 5), sourceController_1.validateSourcesStream);
router.post('/validate', (0, rateLimit_1.rateLimit)(60000, 5), sourceController_1.validateSource);
router.post('/import', sourceController_1.importSources);
router.post('/dedupe', sourceController_1.dedupeSources);
router.get('/:id', sourceController_1.getSource);
router.put('/:id', sourceController_1.updateSource);
router.post('/delete', sourceController_1.deleteSources);
// URL 导入限流：每 IP 每 60 秒最多 3 次
router.post('/import-url', (0, rateLimit_1.rateLimit)(60000, 3), sourceController_1.importFromUrl);
exports.default = router;
//# sourceMappingURL=source.js.map