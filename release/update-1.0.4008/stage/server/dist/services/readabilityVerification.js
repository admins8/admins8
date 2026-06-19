"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyReadableBookCandidate = verifyReadableBookCandidate;
exports.verifyReadableSwitchCandidate = verifyReadableSwitchCandidate;
const sourceAvailability_1 = require("./sourceAvailability");
function withTimeout(task, timeoutMs, fallback) {
    return Promise.race([
        task,
        new Promise((resolve) => setTimeout(() => resolve(fallback), Math.max(1, timeoutMs))),
    ]);
}
function buildBookForReadability(book, source) {
    const bookUrl = book.bookUrl || book.book_url;
    return {
        ...book,
        book_url: bookUrl,
        bookUrl,
        toc_url: bookUrl,
        tocUrl: bookUrl,
        origin: source.book_source_url || source.bookSourceUrl || book.origin || book.sourceUrl,
    };
}
async function loadUsableToc(engine, source, book, timeoutMs) {
    try {
        const toc = await withTimeout(engine.getChapterList(source, buildBookForReadability(book, source)), timeoutMs, []);
        return Array.isArray(toc) ? toc.filter(sourceAvailability_1.isUsableChapter) : [];
    }
    catch {
        return [];
    }
}
async function hasReadableContent(engine, source, book, chapter, timeoutMs) {
    try {
        const content = await withTimeout(engine.getContent(source, buildBookForReadability(book, source), chapter), timeoutMs, '');
        return String(content || '').trim().length > 0;
    }
    catch {
        return false;
    }
}
async function verifyReadableBookCandidate(options) {
    const toc = await loadUsableToc(options.engine, options.source, options.book, options.timeoutMs);
    if (!toc.length) {
        return { readable: false, tocVerified: false, contentVerified: false };
    }
    const chapter = toc[0];
    const contentVerified = await hasReadableContent(options.engine, options.source, options.book, chapter, options.timeoutMs);
    return {
        readable: contentVerified,
        tocVerified: true,
        contentVerified,
        chapter,
    };
}
async function verifyReadableSwitchCandidate(options) {
    const toc = await loadUsableToc(options.engine, options.source, options.book, options.timeoutMs);
    if (!toc.length) {
        return { readable: false, tocVerified: false, contentVerified: false };
    }
    const target = Number(options.chapterIndex);
    const candidates = [
        toc.find(ch => Number(ch.index) === target),
        toc.find(ch => Number(ch.index) === target + 1),
        toc.find(ch => Number(ch.index) === target - 1),
        toc[0],
    ].filter(Boolean);
    const seen = new Set();
    for (const chapter of candidates) {
        const key = `${chapter.index}|${chapter.url}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const contentVerified = await hasReadableContent(options.engine, options.source, options.book, chapter, options.timeoutMs);
        if (contentVerified) {
            return { readable: true, tocVerified: true, contentVerified: true, chapter };
        }
    }
    return { readable: false, tocVerified: true, contentVerified: false, chapter: candidates[0] };
}
//# sourceMappingURL=readabilityVerification.js.map