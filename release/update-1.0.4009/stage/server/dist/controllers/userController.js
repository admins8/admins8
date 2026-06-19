"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheckinStatus = getCheckinStatus;
exports.checkin = checkin;
exports.getCheckinMonth = getCheckinMonth;
const userCheckinService_1 = require("../services/userCheckinService");
async function getCheckinStatus(req, res) {
    try {
        const user = req.user;
        res.json({ code: 0, data: await (0, userCheckinService_1.getUserCheckinStatus)(user.userId) });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function checkin(req, res) {
    try {
        const user = req.user;
        res.json({ code: 0, data: await (0, userCheckinService_1.checkinToday)(user.userId), msg: '签到成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function getCheckinMonth(req, res) {
    try {
        const user = req.user;
        res.json({ code: 0, data: await (0, userCheckinService_1.getUserCheckinMonth)(user.userId, String(req.query.month || '')) });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
//# sourceMappingURL=userController.js.map