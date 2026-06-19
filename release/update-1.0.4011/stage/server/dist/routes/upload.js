"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const uploadController_1 = require("../controllers/uploadController");
const router = (0, express_1.Router)();
router.post('/', auth_1.authMiddleware, auth_1.adminMiddleware, (req, res) => {
    (0, uploadController_1.uploadImageMiddleware)(req, res, (err) => {
        if (err) {
            res.status(400).json({ code: 400, msg: err.message || '上传失败' });
            return;
        }
        (0, uploadController_1.uploadImage)(req, res);
    });
});
exports.default = router;
//# sourceMappingURL=upload.js.map