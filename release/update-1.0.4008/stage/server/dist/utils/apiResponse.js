"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessageForClient = getErrorMessageForClient;
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function getErrorMessageForClient(err, fallbackMessage = '服务器内部错误', nodeEnv = process.env.NODE_ENV) {
    if (nodeEnv === 'production') {
        return fallbackMessage || '服务器内部错误';
    }
    if (err instanceof Error && err.message) {
        return err.message;
    }
    if (typeof err === 'string' && err) {
        return err;
    }
    return fallbackMessage || '服务器内部错误';
}
function sendSuccess(res, data, msg) {
    const payload = { code: 0 };
    if (msg)
        payload.msg = msg;
    if (data !== undefined)
        payload.data = data;
    return res.json(payload);
}
function sendError(res, err, fallbackMessage = '服务器内部错误', statusCode = 500) {
    console.error(err);
    return res.status(statusCode).json({
        code: statusCode,
        msg: getErrorMessageForClient(err, fallbackMessage),
    });
}
//# sourceMappingURL=apiResponse.js.map