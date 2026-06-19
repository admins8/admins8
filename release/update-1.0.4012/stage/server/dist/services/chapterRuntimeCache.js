"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RUNTIME_CONTENT_TTL_MS = exports.DEFAULT_PREFETCH_CHAPTER_COUNT = void 0;
exports.getPrefetchChapterIndexes = getPrefetchChapterIndexes;
exports.getRuntimeChapterContent = getRuntimeChapterContent;
exports.setRuntimeChapterContent = setRuntimeChapterContent;
exports.clearRuntimeChapterContentCache = clearRuntimeChapterContentCache;
exports.DEFAULT_PREFETCH_CHAPTER_COUNT = 5;
exports.DEFAULT_RUNTIME_CONTENT_TTL_MS = 10 * 60 * 1000;
const runtimeChapterContentCache = new Map();
function cacheKey(bookUrl, chapterIndex) {
    return `${bookUrl}::${chapterIndex}`;
}
function getPrefetchChapterIndexes(chapterIndex, count = exports.DEFAULT_PREFETCH_CHAPTER_COUNT) {
    const start = Math.max(0, Math.floor(Number(chapterIndex)) + 1);
    const total = Math.max(0, Math.floor(Number(count)));
    return Array.from({ length: total }, (_, i) => start + i);
}
function getRuntimeChapterContent(bookUrl, chapterIndex, now = Date.now()) {
    const key = cacheKey(bookUrl, chapterIndex);
    const entry = runtimeChapterContentCache.get(key);
    if (!entry)
        return null;
    if (entry.expiresAt <= now) {
        runtimeChapterContentCache.delete(key);
        return null;
    }
    return entry.content;
}
function setRuntimeChapterContent(bookUrl, chapterIndex, content, ttlMs = exports.DEFAULT_RUNTIME_CONTENT_TTL_MS, now = Date.now()) {
    if (!content)
        return;
    runtimeChapterContentCache.set(cacheKey(bookUrl, chapterIndex), {
        content,
        expiresAt: now + Math.max(1000, ttlMs),
    });
}
function clearRuntimeChapterContentCache() {
    runtimeChapterContentCache.clear();
}
//# sourceMappingURL=chapterRuntimeCache.js.map