"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const apiResponse_1 = require("../utils/apiResponse");
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    console.error(`[Error] ${req.method} ${req.path}:`, err);
    res.status(500).json({
        code: 500,
        msg: (0, apiResponse_1.getErrorMessageForClient)(err),
    });
}
function notFoundHandler(req, res) {
    res.status(404).json({
        code: 404,
        msg: `接口不存在: ${req.method} ${req.path}`,
    });
}
//# sourceMappingURL=errorHandler.js.map