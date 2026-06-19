"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_READING_SETTINGS = void 0;
exports.parseBooleanConfig = parseBooleanConfig;
exports.parseGuestReadChapterLimit = parseGuestReadChapterLimit;
exports.canGuestReadChapter = canGuestReadChapter;
exports.canGuestUseSourceSwitch = canGuestUseSourceSwitch;
exports.getReadingSettings = getReadingSettings;
const database_1 = require("../config/database");
exports.DEFAULT_READING_SETTINGS = {
    guestSearchEnabled: true,
    guestReadChapterLimit: 3,
};
function parseBooleanConfig(value, fallback) {
    if (value === true || value === 'true' || value === '1' || value === 1)
        return true;
    if (value === false || value === 'false' || value === '0' || value === 0)
        return false;
    return fallback;
}
function parseGuestReadChapterLimit(value, fallback = exports.DEFAULT_READING_SETTINGS.guestReadChapterLimit) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    const normalized = Math.trunc(parsed);
    if (normalized < -1)
        return fallback;
    return normalized;
}
function canGuestReadChapter(chapterIndex, limit) {
    if (limit === -1)
        return true;
    if (limit <= 0)
        return false;
    return chapterIndex >= 0 && chapterIndex < limit;
}
function canGuestUseSourceSwitch(chapterIndex, limit) {
    return canGuestReadChapter(chapterIndex, limit);
}
async function getReadingSettings() {
    const [guestSearch, guestLimit] = await Promise.all([
        (0, database_1.queryOne)('SELECT config_value FROM site_config WHERE config_key = ?', ['guest_search_enabled']),
        (0, database_1.queryOne)('SELECT config_value FROM site_config WHERE config_key = ?', ['guest_read_chapter_limit']),
    ]);
    return {
        guestSearchEnabled: parseBooleanConfig(guestSearch?.config_value, exports.DEFAULT_READING_SETTINGS.guestSearchEnabled),
        guestReadChapterLimit: parseGuestReadChapterLimit(guestLimit?.config_value),
    };
}
//# sourceMappingURL=readingSettings.js.map