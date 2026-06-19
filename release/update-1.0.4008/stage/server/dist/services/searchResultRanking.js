"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSearchText = normalizeSearchText;
exports.getSearchMatchScore = getSearchMatchScore;
exports.classifySearchResult = classifySearchResult;
exports.rankSearchResults = rankSearchResults;
exports.getAggregateKey = getAggregateKey;
exports.aggregateSearchResults = aggregateSearchResults;
exports.shouldEmitImmediateSearchResult = shouldEmitImmediateSearchResult;
exports.getSearchWindow = getSearchWindow;
function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
}
function getSearchMatchScore(keyword, bookName) {
    const cleanKw = normalizeSearchText(keyword);
    const nameClean = normalizeSearchText(bookName);
    if (!cleanKw || !nameClean)
        return 0;
    if (nameClean === cleanKw)
        return 100;
    if (nameClean.startsWith(cleanKw))
        return 80;
    if (nameClean.includes(cleanKw))
        return 60;
    if (cleanKw.length >= 4) {
        const minLen = Math.max(2, Math.floor(cleanKw.length * 0.7));
        for (let j = 0; j <= cleanKw.length - minLen; j++) {
            if (nameClean.includes(cleanKw.slice(j, j + minLen)))
                return 30;
        }
    }
    return 0;
}
function classifySearchResult(keyword, book) {
    const nameScore = getSearchMatchScore(keyword, book.name);
    const nameClean = normalizeSearchText(book.name);
    const keywordClean = normalizeSearchText(keyword);
    const authorClean = normalizeSearchText(book.author);
    const isExactName = !!keywordClean && nameClean === keywordClean;
    const isKnownAuthor = authorClean === normalizeSearchText('天蚕土豆');
    if (isExactName && isKnownAuthor) {
        return { level: 'exact', label: '精确匹配', score: 1000 };
    }
    if (isExactName) {
        return { level: 'exact', label: '同名匹配', score: 900 };
    }
    if (nameScore >= 60) {
        return { level: 'related', label: '相关结果', score: nameScore };
    }
    if (nameScore > 0) {
        return { level: 'weak', label: '弱相关', score: nameScore };
    }
    return { level: 'none', label: '不匹配', score: 0 };
}
function isLikelyImageOrAudioSource(book) {
    const text = normalizeSearchText(`${book.sourceName || book.originName || ''}${book.kind || ''}`);
    return /漫画|漫蛙|喜漫|favcomic|有声|听书|喜马拉雅|音频/.test(text);
}
function readableSourceScore(book) {
    return isLikelyImageOrAudioSource(book) ? -100 : 0;
}
function tocScore(book) {
    return book._tocVerified === true ? 50 : 0;
}
function contentScore(book) {
    return book._readable === true || book._contentVerified === true ? 100 : 0;
}
function localScore(book) {
    return book._local === true ? 10000 : 0;
}
function rankSearchResults(keyword, results) {
    return [...results].sort((a, b) => {
        const localDiff = localScore(b) - localScore(a);
        if (localDiff !== 0)
            return localDiff;
        const scoreDiff = classifySearchResult(keyword, b).score - classifySearchResult(keyword, a).score;
        if (scoreDiff !== 0)
            return scoreDiff;
        const contentDiff = contentScore(b) - contentScore(a);
        if (contentDiff !== 0)
            return contentDiff;
        const tocDiff = tocScore(b) - tocScore(a);
        if (tocDiff !== 0)
            return tocDiff;
        const readableDiff = readableSourceScore(b) - readableSourceScore(a);
        if (readableDiff !== 0)
            return readableDiff;
        const aNameLength = normalizeSearchText(a.name).length;
        const bNameLength = normalizeSearchText(b.name).length;
        return aNameLength - bNameLength;
    });
}
function getAggregateKey(book) {
    return `${normalizeSearchText(book.name)}|${normalizeSearchText(book.author)}`;
}
function toAggregatedSource(book) {
    return {
        bookUrl: book.bookUrl || book.book_url || '',
        sourceUrl: book.sourceUrl || book.origin || '',
        sourceName: book.sourceName || book.originName || '',
        coverUrl: book.coverUrl,
        intro: book.intro,
        kind: book.kind,
        latestChapterTitle: book.latestChapterTitle,
        wordCount: book.wordCount,
        type: book.type,
        _tocVerified: book._tocVerified,
        _contentVerified: book._contentVerified,
        _readable: book._readable,
        _matchLevel: book._matchLevel,
        _matchLabel: book._matchLabel,
        _matchScore: book._matchScore,
    };
}
function aggregateSearchResults(keyword, results) {
    const groups = new Map();
    for (const book of rankSearchResults(keyword, results)) {
        const key = getAggregateKey(book);
        if (!key || key === '|')
            continue;
        const source = toAggregatedSource(book);
        if (!source.bookUrl)
            continue;
        const existing = groups.get(key);
        if (!existing) {
            groups.set(key, {
                ...book,
                _aggregateKey: key,
                sourceCount: 1,
                sources: [source],
            });
            continue;
        }
        const duplicated = existing.sources.some((item) => item.bookUrl === source.bookUrl || (!!item.sourceUrl && item.sourceUrl === source.sourceUrl));
        if (!duplicated) {
            existing.sources.push(source);
            existing.sourceCount = existing.sources.length;
        }
    }
    return [...groups.values()].sort((a, b) => {
        const localDiff = localScore(b) - localScore(a);
        if (localDiff !== 0)
            return localDiff;
        const scoreDiff = classifySearchResult(keyword, b).score - classifySearchResult(keyword, a).score;
        if (scoreDiff !== 0)
            return scoreDiff;
        const contentDiff = contentScore(b) - contentScore(a);
        if (contentDiff !== 0)
            return contentDiff;
        const tocDiff = tocScore(b) - tocScore(a);
        if (tocDiff !== 0)
            return tocDiff;
        const readableDiff = readableSourceScore(b) - readableSourceScore(a);
        if (readableDiff !== 0)
            return readableDiff;
        const sourceDiff = b.sourceCount - a.sourceCount;
        if (sourceDiff !== 0)
            return sourceDiff;
        const aNameLength = normalizeSearchText(a.name).length;
        const bNameLength = normalizeSearchText(b.name).length;
        return aNameLength - bNameLength;
    });
}
function shouldEmitImmediateSearchResult(book, options = {}) {
    if (book?._matchLevel !== 'exact')
        return false;
    if (options.forceVerifyToc)
        return book._readable === true;
    return true;
}
function getSearchWindow(sources, startIndex, maxScanCount) {
    const safeStart = Math.max(0, Math.min(startIndex, sources.length));
    const searchedLimit = typeof maxScanCount === 'number'
        ? Math.min(safeStart + Math.max(1, maxScanCount), sources.length)
        : sources.length;
    return {
        totalSources: sources.length,
        remainingSources: sources.slice(safeStart, searchedLimit),
        hasMore: searchedLimit < sources.length,
        searchedLimit,
    };
}
//# sourceMappingURL=searchResultRanking.js.map