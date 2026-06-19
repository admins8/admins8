"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSourceUrlForDedupe = normalizeSourceUrlForDedupe;
exports.findDuplicateSourceIds = findDuplicateSourceIds;
function normalizeSourceUrlForDedupe(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    try {
        const url = new URL(raw);
        url.hash = '';
        if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
            url.port = '';
        }
        url.hostname = url.hostname.toLowerCase();
        url.pathname = url.pathname.replace(/\/+$/, '');
        return url.toString().replace(/\/$/, '');
    }
    catch {
        return raw.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
    }
}
function findDuplicateSourceIds(rows) {
    const seen = new Set();
    const duplicateIds = [];
    const ordered = [...rows].sort((a, b) => Number(a.id) - Number(b.id));
    for (const row of ordered) {
        const key = normalizeSourceUrlForDedupe(row.book_source_url);
        if (!key)
            continue;
        if (seen.has(key)) {
            duplicateIds.push(Number(row.id));
        }
        else {
            seen.add(key);
        }
    }
    return duplicateIds;
}
//# sourceMappingURL=sourceDedupe.js.map