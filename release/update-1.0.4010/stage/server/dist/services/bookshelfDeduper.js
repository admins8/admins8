"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookIdentityKey = getBookIdentityKey;
exports.dedupeBookshelfRows = dedupeBookshelfRows;
function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}
function getTimeValue(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
}
function getBookIdentityKey(book) {
    const name = normalizeText(book?.name);
    const author = normalizeText(book?.author);
    if (!name)
        return '';
    return `${name}|${author}`;
}
function dedupeBookshelfRows(rows) {
    const map = new Map();
    const passthrough = [];
    for (const row of rows || []) {
        const key = getBookIdentityKey(row);
        if (!key) {
            passthrough.push(row);
            continue;
        }
        const existing = map.get(key);
        if (!existing) {
            map.set(key, row);
            continue;
        }
        const currentTime = getTimeValue(row.durChapterTime || row.lastReadTime || row.updatedAt || row.updated_at);
        const existingTime = getTimeValue(existing.durChapterTime || existing.lastReadTime || existing.updatedAt || existing.updated_at);
        if (currentTime >= existingTime) {
            map.set(key, row);
        }
    }
    return [...map.values(), ...passthrough].sort((a, b) => {
        const timeA = getTimeValue(a.durChapterTime || a.lastReadTime || a.updatedAt || a.updated_at);
        const timeB = getTimeValue(b.durChapterTime || b.lastReadTime || b.updatedAt || b.updated_at);
        return timeB - timeA;
    });
}
//# sourceMappingURL=bookshelfDeduper.js.map