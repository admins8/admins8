"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySwitchTargetReadable = verifySwitchTargetReadable;
const sourceAvailability_1 = require("./sourceAvailability");
const readabilityVerification_1 = require("./readabilityVerification");
async function verifySwitchTargetReadable(newBook, chapterIndex, deps) {
    const sourceUrl = newBook?.sourceUrl || newBook?.origin;
    if (!sourceUrl || !newBook?.bookUrl) {
        return { ok: false, msg: '新书源信息不完整' };
    }
    const source = await deps.findSourceByUrl(sourceUrl);
    if (!source) {
        return { ok: false, msg: '新书源不存在或已被禁用' };
    }
    const engine = deps.createEngine();
    const toc = await engine.getChapterList(source, {
        ...newBook,
        book_url: newBook.bookUrl,
        bookUrl: newBook.bookUrl,
        toc_url: newBook.bookUrl,
        tocUrl: newBook.bookUrl,
        origin: sourceUrl,
    });
    const usableToc = Array.isArray(toc) ? toc.filter(sourceAvailability_1.isUsableChapter) : [];
    if (usableToc.length < 1) {
        return { ok: false, msg: '该书源目录不可用，已跳过切换' };
    }
    if (typeof engine.getContent === 'function') {
        const readable = await (0, readabilityVerification_1.verifyReadableSwitchCandidate)({
            engine: engine,
            source,
            book: newBook,
            chapterIndex,
            timeoutMs: 8000,
        });
        if (!readable.readable) {
            return { ok: false, msg: '该书源当前章节正文不可用，已跳过切换' };
        }
    }
    return { ok: true, toc: usableToc };
}
//# sourceMappingURL=switchSourceVerification.js.map