"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeChapterList = normalizeChapterList;
const sourceAvailability_1 = require("./sourceAvailability");
function normalizeTitle(title) {
    return String(title || '').replace(/\s+/g, ' ').trim();
}
function normalizeUrl(url) {
    return String(url || '').trim();
}
function normalizeChapterList(input, options = {}) {
    const result = [];
    const seenUrls = new Set();
    const seenTitles = new Set();
    const dedupeTitle = options.dedupeTitle !== false;
    for (const raw of Array.isArray(input) ? input : []) {
        const title = normalizeTitle(raw?.title);
        const url = normalizeUrl(raw?.url);
        const chapter = { ...raw, title, url };
        if (!(0, sourceAvailability_1.isUsableChapter)(chapter))
            continue;
        const urlKey = url.toLowerCase();
        const titleKey = title.toLowerCase();
        if (seenUrls.has(urlKey) || (dedupeTitle && seenTitles.has(titleKey)))
            continue;
        seenUrls.add(urlKey);
        if (dedupeTitle)
            seenTitles.add(titleKey);
        result.push({ ...chapter, index: result.length });
    }
    return result;
}
//# sourceMappingURL=chapterListNormalizer.js.map