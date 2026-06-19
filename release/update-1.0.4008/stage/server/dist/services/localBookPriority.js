"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSameLocalBook = isSameLocalBook;
exports.buildLocalBookResult = buildLocalBookResult;
function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}
function isSameLocalBook(a, b) {
    const aName = normalize(a.name);
    const bName = normalize(b.name);
    if (!aName || !bName || aName !== bName)
        return false;
    const aAuthor = normalize(a.author);
    const bAuthor = normalize(b.author);
    return !aAuthor || !bAuthor || aAuthor === bAuthor;
}
function buildLocalBookResult(row, match) {
    const bookUrl = String(row.bookUrl || row.book_url || '').trim();
    const sourceUrl = String(row.sourceUrl || row.origin || '').trim();
    const sourceName = String(row.sourceName || row.originName || '').trim() || '本地书库';
    const coverUrl = row.coverUrl || row.cover_url || '';
    const latestChapterTitle = row.latestChapterTitle || row.latest_chapter_title || '';
    const wordCount = row.wordCount || row.word_count || '';
    const kind = row.kind || row.category || '';
    const aggregateKey = `${normalize(row.name)}|${normalize(row.author)}`;
    return {
        bookUrl,
        name: row.name || '',
        author: row.author || '',
        coverUrl,
        intro: row.intro || '',
        sourceUrl,
        sourceName,
        kind,
        latestChapterTitle,
        wordCount,
        type: row.type,
        _local: true,
        _readable: true,
        _tocVerified: true,
        _matchLevel: match.matchLevel,
        _matchLabel: match.matchLabel,
        _matchScore: match.matchScore,
        _aggregateKey: aggregateKey,
        sourceCount: 1,
        sources: [{
                bookUrl,
                sourceUrl,
                sourceName,
                coverUrl,
                intro: row.intro || '',
                kind,
                latestChapterTitle,
                wordCount,
                type: row.type,
                _local: true,
                _tocVerified: true,
                _readable: true,
                _matchLevel: match.matchLevel,
                _matchLabel: match.matchLabel,
                _matchScore: match.matchScore,
            }],
    };
}
//# sourceMappingURL=localBookPriority.js.map