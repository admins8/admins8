"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNextContentUrls = normalizeNextContentUrls;
function normalizeNextContentUrls(values, baseUrl) {
    const result = [];
    const seen = new Set();
    for (const value of values) {
        const raw = String(value || '').trim();
        if (!raw)
            continue;
        let absolute = raw;
        try {
            absolute = new URL(raw, baseUrl).href;
        }
        catch {
            continue;
        }
        if (absolute === baseUrl || seen.has(absolute))
            continue;
        seen.add(absolute);
        result.push(absolute);
    }
    return result;
}
//# sourceMappingURL=contentPagination.js.map