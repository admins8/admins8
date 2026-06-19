"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rssSourceController_1 = require("../controllers/rssSourceController");
const auth_1 = require("../middleware/auth");
const permissionService_1 = require("../services/permissionService");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, (0, auth_1.permissionMiddleware)(permissionService_1.PERMISSIONS.SOURCE_MANAGE));
router.get('/', rssSourceController_1.getRssSources);
router.post('/import-url', (0, rateLimit_1.rateLimit)(60000, 3), rssSourceController_1.importRssSourceUrl);
router.put('/:id', rssSourceController_1.putRssSource);
router.post('/delete', rssSourceController_1.removeRssSources);
router.get('/:id/articles', (0, rateLimit_1.rateLimit)(60000, 20), rssSourceController_1.getRssArticles);
router.get('/:id/content', (0, rateLimit_1.rateLimit)(60000, 60), rssSourceController_1.getRssContent);
exports.default = router;
//# sourceMappingURL=rssSource.js.map