"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildJinaMarkdownSnapshotUrl = buildJinaMarkdownSnapshotUrl;
exports.shouldUseJinaSnapshot = shouldUseJinaSnapshot;
exports.buildTargetAccessAttempts = buildTargetAccessAttempts;
exports.isJinaMarkdownSnapshot = isJinaMarkdownSnapshot;
exports.jinaMarkdownContent = jinaMarkdownContent;
exports.normalizeJinaMarkdownText = normalizeJinaMarkdownText;
exports.extractJinaMarkdownLinks = extractJinaMarkdownLinks;
exports.extractJinaMarkdownText = extractJinaMarkdownText;
exports.requestTargetHtml = requestTargetHtml;
const bookSourceHttpClient_1 = require("./bookSourceHttpClient");
const JINA_SUPPORTED_HOST_PATTERNS = [
    /(^|\.)ipaoshuba\.net$/i,
    /(^|\.)paoshuba\.com$/i,
    /(^|\.)paoshu8\.com$/i,
];
function buildJinaMarkdownSnapshotUrl(url) {
    return `https://r.jina.ai/http://r.jina.ai/http://${url}`;
}
function shouldUseJinaSnapshot(url, option = {}) {
    if (String(option.method || 'GET').toUpperCase() !== 'GET')
        return false;
    try {
        const host = new URL(url).hostname;
        return JINA_SUPPORTED_HOST_PATTERNS.some(pattern => pattern.test(host));
    }
    catch {
        return false;
    }
}
function buildTargetAccessAttempts(url, option = {}) {
    const mode = option.targetAccessMode || 'direct';
    if (mode === 'direct' || !shouldUseJinaSnapshot(url, option))
        return [url];
    const snapshotUrl = buildJinaMarkdownSnapshotUrl(url);
    if (mode === 'snapshot-first')
        return [snapshotUrl, url];
    return [url, snapshotUrl];
}
function isJinaMarkdownSnapshot(html) {
    return /URL Source:\s*https?:\/\/[^\n]+/i.test(String(html || '')) && String(html || '').includes('Markdown Content:');
}
function jinaMarkdownContent(html) {
    const raw = String(html || '');
    const index = raw.indexOf('Markdown Content:');
    return index >= 0 ? raw.slice(index + 'Markdown Content:'.length).trim() : raw.trim();
}
function normalizeJinaMarkdownText(value) {
    return String(value || '')
        .replace(/\\\*/g, '*')
        .replace(/[*_`]+/g, '')
        .replace(/\[[^\]]+\]\([^)]+\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractJinaMarkdownLinks(html) {
    const markdown = jinaMarkdownContent(html);
    const results = [];
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match;
    while ((match = linkPattern.exec(markdown))) {
        const title = normalizeJinaMarkdownText(match[1]);
        const url = String(match[2] || '').trim();
        if (title && url)
            results.push({ title, url });
    }
    return results;
}
function extractJinaMarkdownText(html) {
    return normalizeJinaMarkdownText(jinaMarkdownContent(html)
        .replace(/^Title:.*$/gm, '')
        .replace(/^URL Source:.*$/gm, '')
        .replace(/^#+\s+.*$/gm, ''));
}
async function requestTargetHtml(url, headers, option = {}) {
    const attempts = buildTargetAccessAttempts(url, option);
    let lastError;
    for (const attemptUrl of attempts) {
        try {
            return await (0, bookSourceHttpClient_1.httpRequest)(attemptUrl, attemptUrl === url ? headers : (0, bookSourceHttpClient_1.buildHeaders)(''), {
                ...option,
                targetAccessMode: 'direct',
                charset: attemptUrl === url ? option.charset : 'utf-8',
                timeoutMs: attemptUrl === url ? option.timeoutMs : Math.max(option.timeoutMs || 0, 30000),
            });
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
//# sourceMappingURL=targetAccess.js.map