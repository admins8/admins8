"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCurrentReadingSource = isCurrentReadingSource;
exports.buildAlternateSourceResult = buildAlternateSourceResult;
function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}
function normalizeUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}
function isCurrentReadingSource(source, book, matched) {
    const sourceUrl = normalizeUrl(source.book_source_url || source.bookSourceUrl);
    const currentOrigin = normalizeUrl(book.origin);
    const matchedBookUrl = normalizeUrl(matched.bookUrl);
    const currentBookUrl = normalizeUrl(book.book_url || book.bookUrl);
    return Boolean((sourceUrl && currentOrigin && sourceUrl === currentOrigin) ||
        (matchedBookUrl && currentBookUrl && matchedBookUrl === currentBookUrl));
}
function buildAlternateSourceResult(matched, source, book) {
    return {
        ...matched,
        sourceUrl: source.book_source_url || source.bookSourceUrl,
        sourceName: source.book_source_name || source.bookSourceName,
        matchScore: normalizeText(matched.author) === normalizeText(book.author) ? 2 : 1,
        isCurrentSource: isCurrentReadingSource(source, book, matched),
    };
}
//# sourceMappingURL=alternateSource.js.map