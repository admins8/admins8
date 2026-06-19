"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chapterContentLoadQueue = exports.ChapterContentLoadQueue = void 0;
class ChapterContentLoadQueue {
    running = new Map();
    key(bookUrl, chapterIndex) {
        return `${bookUrl}::${chapterIndex}`;
    }
    async run(bookUrl, chapterIndex, task) {
        const key = this.key(bookUrl, chapterIndex);
        const existing = this.running.get(key);
        if (existing)
            return existing;
        const promise = task().finally(() => {
            this.running.delete(key);
        });
        this.running.set(key, promise);
        return promise;
    }
}
exports.ChapterContentLoadQueue = ChapterContentLoadQueue;
exports.chapterContentLoadQueue = new ChapterContentLoadQueue();
//# sourceMappingURL=chapterContentLoader.js.map