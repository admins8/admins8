"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
router.post('/register', (0, rateLimit_1.rateLimit)(60000, 5), authController_1.register);
router.post('/login', (0, rateLimit_1.rateLimit)(60000, 10), authController_1.login);
router.post('/logout', authController_1.logout);
router.get('/profile', auth_1.authMiddleware, authController_1.getProfile);
router.put('/profile', auth_1.authMiddleware, authController_1.updateProfile);
router.post('/change-password', auth_1.authMiddleware, authController_1.changePassword);
router.post('/forgot-password', (0, rateLimit_1.rateLimit)(60000, 3), authController_1.forgotPassword);
router.post('/reset-password', (0, rateLimit_1.rateLimit)(60000, 5), authController_1.resetPassword);
exports.default = router;
//# sourceMappingURL=auth.js.map