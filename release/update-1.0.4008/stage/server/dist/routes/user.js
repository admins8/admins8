"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/checkin-status', userController_1.getCheckinStatus);
router.get('/checkin-month', userController_1.getCheckinMonth);
router.post('/checkin', userController_1.checkin);
exports.default = router;
//# sourceMappingURL=user.js.map