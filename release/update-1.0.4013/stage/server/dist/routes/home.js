"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const homeController_1 = require("../controllers/homeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 公开接口（首页展示用）
router.get('/searches', homeController_1.getHotSearches);
router.get('/rankings', homeController_1.getHotRankings);
router.get('/rankings/grouped', homeController_1.getRankingsGrouped);
router.get('/rankings/meta', homeController_1.getRankingMeta);
router.get('/tags', homeController_1.getHotTags);
router.get('/library', homeController_1.getLocalLibrary);
// 管理接口（需要管理员权限）
router.use(auth_1.authMiddleware, auth_1.adminMiddleware);
router.get('/searches/all', homeController_1.getAllHotSearches);
router.post('/searches', homeController_1.addHotSearch);
router.put('/searches', homeController_1.updateHotSearch);
router.post('/searches/delete', homeController_1.deleteHotSearch);
router.get('/rankings/all', homeController_1.getAllHotRankings);
router.post('/rankings', homeController_1.addHotRanking);
router.put('/rankings', homeController_1.updateHotRanking);
router.post('/rankings/delete', homeController_1.deleteHotRanking);
router.post('/rankings/refresh', homeController_1.refreshRankingsFromUserData);
router.get('/tags/all', homeController_1.getAllHotTags);
router.post('/tags', homeController_1.addHotTag);
router.put('/tags', homeController_1.updateHotTag);
router.post('/tags/delete', homeController_1.deleteHotTag);
exports.default = router;
//# sourceMappingURL=home.js.map