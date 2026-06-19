"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POPUP_AUTO_CLOSE_SECONDS = exports.DEFAULT_POPUP_INTERVAL_SECONDS = void 0;
exports.normalizePopupSeconds = normalizePopupSeconds;
exports.DEFAULT_POPUP_INTERVAL_SECONDS = 3600;
exports.DEFAULT_POPUP_AUTO_CLOSE_SECONDS = 10;
function normalizePopupSeconds(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
        return fallback;
    return Math.floor(parsed);
}
//# sourceMappingURL=adDefaults.js.map