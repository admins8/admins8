"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adController_1 = require("../controllers/adController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 公开接口：按位置获取启用中的广告
router.get('/list', adController_1.getAdsByPosition);
// 管理接口
router.use(auth_1.authMiddleware, auth_1.adminMiddleware);
router.get('/all', adController_1.getAllAds);
router.post('/', adController_1.addAd);
router.put('/', adController_1.updateAd);
router.post('/delete', adController_1.deleteAd);
exports.default = router;
//# sourceMappingURL=ad.js.map