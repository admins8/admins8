"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const licenseService_1 = require("../services/licenseService");
const router = (0, express_1.Router)();
/**
 * 公开的授权状态接口：返回脱敏信息，便于运维确认服务是否已激活。
 */
router.get('/status', (_req, res) => {
    const lic = (0, licenseService_1.getActiveLicense)();
    if (!lic) {
        res.json({ code: 0, data: { activated: false } });
        return;
    }
    res.json({
        code: 0,
        data: {
            activated: true,
            licenseId: lic.licenseId,
            customerId: lic.customerId,
            customerName: lic.customerName || '',
            domains: lic.domains,
            issuedAt: lic.issuedAt,
            features: lic.features || {},
        },
    });
});
exports.default = router;
//# sourceMappingURL=license.js.map