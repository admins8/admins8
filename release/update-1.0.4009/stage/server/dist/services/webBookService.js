"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.webBookEngine = exports.WebBookEngine = void 0;
exports.executeRule = executeRule;
const cheerio = __importStar(require("cheerio"));
const jsonpath_plus_1 = require("jsonpath-plus");
const ruleExecutor_1 = require("./ruleExecutor");
const contentCleaner_1 = require("./contentCleaner");
const bookSourceHttpClient_1 = require("./bookSourceHttpClient");
const contentPagination_1 = require("./contentPagination");
const targetAccess_1 = require("./targetAccess");
function normalizeBookListRule(rule) {
    if (!rule)
        return '';
    const pathAssignment = rule.match(/path\s*=\s*['"]([^'"]+)['"]/);
    if (pathAssignment && rule.includes('java.getElement(path)')) {
        return pathAssignment[1];
    }
    return rule.replace(/<js>[\s\S]*?<\/js>/g, '').trim();
}
function renderJsonTemplate(rule, elementData) {
    if (!rule || !rule.includes('{{$.'))
        return rule;
    return rule.replace(/\{\{\$\.([^}]+)\}\}/g, (_match, path) => {
        const value = String(path).split('.').reduce((acc, key) => acc?.[key], elementData);
        return value === undefined || value === null ? '' : String(value);
    });
}
// ============ Legado 规则解析引擎 ============
function parseJsoupSelector(selector, $, context) {
    selector = selector.trim().replace(/^@css:\s*/i, '');
    const parts = selector.split('.');
    if (parts.length === 0)
        return $();
    const type = parts[0].toLowerCase();
    const name = parts.length > 1 ? parts[1] : '';
    const rest = parts.length > 2 ? parts.slice(2).join('.') : '';
    const searchRoot = context ? $(context) : $('body');
    let elements;
    switch (type) {
        case 'class':
            elements = searchRoot.find('.' + name.replace(/\s/g, '\\.'));
            break;
        case 'id':
            elements = $('#' + name);
            break;
        case 'tag':
            elements = searchRoot.find(name);
            break;
        case 'text':
            elements = searchRoot.find('*').filter(function () {
                return $(this).text().includes(name);
            });
            break;
        case 'children':
            elements = searchRoot.children();
            break;
        default:
            const shortTag = selector.match(/^([a-zA-Z][\w-]*)(?:\.(.+))?$/);
            if (shortTag && (!shortTag[2] || /^[\d.![\],:]+$/.test(shortTag[2]))) {
                elements = context ? searchRoot.filter(shortTag[1]).add(searchRoot.find(shortTag[1])) : $(shortTag[1]);
                const shortRest = shortTag[2] || '';
                if (shortRest) {
                    if (shortRest.includes('!')) {
                        const excludePart = shortRest.split('!')[1];
                        const excludeIndices = excludePart.split(':').map(Number).filter((n) => !isNaN(n));
                        const allElements = elements.toArray();
                        elements = $(allElements.filter((_, idx) => !excludeIndices.includes(idx)));
                    }
                    else {
                        const indices = shortRest.split('.').map(Number).filter((n) => !isNaN(n));
                        if (indices.length > 0) {
                            const allElements = elements.toArray();
                            elements = $(indices.map((i) => allElements[i]).filter(Boolean));
                        }
                    }
                }
                return elements;
            }
            try {
                elements = context ? searchRoot.filter(selector).add(searchRoot.find(selector)) : $(selector);
            }
            catch {
                elements = $();
            }
            return elements;
    }
    if (rest) {
        if (rest.includes('!')) {
            const excludePart = rest.split('!')[1];
            const excludeIndices = excludePart.split(':').map(Number).filter((n) => !isNaN(n));
            const allElements = elements.toArray();
            elements = $(allElements.filter((_, idx) => !excludeIndices.includes(idx)));
        }
        else if (rest.includes('[')) {
            const match = rest.match(/\[([^\]]+)\]/);
            if (match) {
                const inner = match[1];
                const allElements = elements.toArray();
                if (inner.startsWith('!')) {
                    const excludeIndices = inner.substring(1).split(',').map(Number).filter((n) => !isNaN(n));
                    elements = $(allElements.filter((_, idx) => !excludeIndices.includes(idx)));
                }
                else {
                    const indices = inner.split(',').map(Number).filter((n) => !isNaN(n));
                    elements = $(indices.map((i) => allElements[i]).filter(Boolean));
                }
            }
        }
        else {
            const indices = rest.split('.').map(Number).filter((n) => !isNaN(n));
            if (indices.length > 0) {
                const allElements = elements.toArray();
                elements = $(indices.map((i) => allElements[i]).filter(Boolean));
            }
        }
    }
    return elements;
}
function parseLegadoRule(rule, $, context) {
    const chainTypes = ['||', '&&', '%%'];
    for (const chainType of chainTypes) {
        if (rule.includes(chainType)) {
            const parts = rule.split(chainType);
            let results = $.root();
            for (const part of parts) {
                const r = parseLegadoRule(part.trim(), $, context);
                if (chainType === '||') {
                    if (r.length > 0)
                        return r;
                }
                else if (chainType === '&&') {
                    results = results.add(r.get());
                }
            }
            return results;
        }
    }
    // Split by @ but handle chained selectors like class.grid@tag.tr!0
    // vs attribute extraction like class.xxx@href
    const atParts = rule.split('@');
    if (atParts.length <= 1) {
        // No @ at all, just parse as JSOUP selector
        return parseJsoupSelector(rule, $, context);
    }
    // Check if the last part is an attribute extraction suffix
    const lastPart = atParts[atParts.length - 1];
    const knownAttrSuffixes = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
        'data-original', 'data-src', 'content'];
    const isAttrSuffix = knownAttrSuffixes.includes(lastPart) ||
        lastPart.startsWith('attr.') || lastPart.startsWith('data-');
    if (isAttrSuffix && atParts.length >= 2) {
        // This is selector@attr format (e.g., class.odd.0@tag.a@href)
        const selectorRule = atParts.slice(0, -1).join('@');
        const elements = parseLegadoRule(selectorRule, $, context);
        const elem = elements.length > 0 ? elements.first() : null;
        if (!elem)
            return $();
        if (lastPart.startsWith('text')) {
            return elem.text().trim();
        }
        else if (lastPart.startsWith('html')) {
            return elem.html() || '';
        }
        else if (lastPart.startsWith('href')) {
            return elem.attr('href') || '';
        }
        else if (lastPart.startsWith('src')) {
            return elem.attr('src') || '';
        }
        else {
            return elem.attr(lastPart) || elem.text().trim();
        }
    }
    // This is a chain of JSOUP selectors: class.grid@tag.tr!0
    // Parse step by step, using previous result as context
    let elements = context ? $(context) : $.root();
    for (const part of atParts) {
        if (!part)
            continue;
        if (elements.length > 0) {
            // Collect results from all elements, not just the first one
            const allResults = [];
            elements.each((i, el) => {
                const result = parseJsoupSelector(part, $, el);
                if (result.length > 0) {
                    result.each((j, r) => {
                        allResults.push(r);
                    });
                }
            });
            elements = $(allResults);
        }
        else {
            elements = parseJsoupSelector(part, $, undefined);
        }
    }
    return elements;
}
function getResultFromElement(element, $, suffix) {
    const el = $(element);
    switch (suffix) {
        case 'text': return el.text().trim();
        case 'textNodes':
            return el.contents().filter(function () { return this.type === 'text'; }).text().trim();
        case 'ownText': return el.contents().first().text().trim();
        case 'html': return el.html() || '';
        case 'all': return $.html(element) || '';
        case 'src':
        case 'href':
        case 'data-original':
        case 'data-src':
            return el.attr(suffix) || '';
        default:
            if (suffix.startsWith('attr.'))
                return el.attr(suffix.substring(5)) || '';
            return el.attr(suffix) || '';
    }
}
function executeRule(rule, html, isJson = false) {
    return (0, ruleExecutor_1.executeRule)(rule, html, isJson);
}
function executeJsoupRule(rule, html, isJson) {
    return (0, ruleExecutor_1.executeRule)(rule, html, isJson);
}
class WebBookEngine {
    requestOptions;
    headers = {};
    constructor(requestOptions = {}) {
        this.requestOptions = requestOptions;
    }
    withRequestOptions(option = {}) {
        return {
            ...option,
            simulatedUserAgents: this.requestOptions.simulatedUserAgents,
            forceRandomUserAgent: this.requestOptions.forceRandomUserAgent,
            proxy: this.requestOptions.proxy || option.proxy,
            targetAccessMode: this.requestOptions.targetAccessMode || option.targetAccessMode,
        };
    }
    async fetchTargetHtml(url, option = {}) {
        const requestHtml = this.requestOptions.requestHtml || targetAccess_1.requestTargetHtml;
        return requestHtml(url, this.headers, this.withRequestOptions(option));
    }
    normalizeTargetUrl(rawUrl, baseUrl) {
        const raw = String(rawUrl || '').trim();
        if (!raw)
            return null;
        const parsed = (0, bookSourceHttpClient_1.parseSearchUrl)(raw);
        let url = String(parsed.url || '').trim();
        if (!url)
            return null;
        if (!/^https?:\/\//i.test(url)) {
            try {
                url = new URL(url, baseUrl).href;
            }
            catch {
                url = baseUrl + url;
            }
        }
        return { url, option: parsed.option || {} };
    }
    renderBaseUrlTemplate(rule, baseUrl) {
        const raw = String(rule || '').trim();
        const match = raw.match(/^\{\{([\s\S]+)\}\}$/);
        if (!match)
            return raw;
        try {
            const fn = Function('baseUrl', `"use strict"; return (${match[1]});`);
            const value = fn(baseUrl);
            return value === undefined || value === null ? '' : String(value);
        }
        catch {
            return raw;
        }
    }
    extractTocTargetFromBookInfo(source, detailHtml, detailUrl) {
        const ruleInfo = typeof source.rule_book_info === 'string'
            ? JSON.parse(source.rule_book_info)
            : (source.rule_book_info || source.ruleBookInfo || {});
        if (!ruleInfo.tocUrl)
            return null;
        const renderedRule = this.renderBaseUrlTemplate(ruleInfo.tocUrl, detailUrl);
        let tocRaw = '';
        if (/^(https?:\/\/|\/)/i.test(renderedRule)) {
            tocRaw = renderedRule;
        }
        else {
            const result = executeRule(renderedRule, detailHtml);
            tocRaw = result[0] || '';
        }
        return this.normalizeTargetUrl(tocRaw, detailUrl);
    }
    initHeaders(source) {
        this.headers = (0, bookSourceHttpClient_1.buildHeaders)(source.header || null);
    }
    buildSearchRequest(rawSearchUrl, keyword, baseUrl) {
        if (!rawSearchUrl)
            return { url: '', option: {} };
        let processed = (0, bookSourceHttpClient_1.resolveScriptSearchUrl)(rawSearchUrl, baseUrl)
            .replace(/\{\{key\}\}/g, encodeURIComponent(keyword))
            .replace(/\{\{page\}\}/g, '1')
            .replace(/\\$/g, encodeURIComponent(keyword));
        const { url, option } = (0, bookSourceHttpClient_1.parseSearchUrl)(processed);
        let finalUrl = url;
        if (finalUrl && !finalUrl.startsWith('http') && baseUrl) {
            try {
                const cleanBase = baseUrl.split('#')[0].split('/').slice(0, 3).join('/');
                finalUrl = new URL(finalUrl, cleanBase).href;
            }
            catch {
                finalUrl = baseUrl + finalUrl;
            }
        }
        return { url: finalUrl, option };
    }
    async search(source, keyword) {
        this.initHeaders(source);
        const sourceName = source.book_source_name || source.bookSourceName || '未知';
        const { url, option } = this.buildSearchRequest(source.searchUrl || source.search_url, keyword, source.bookSourceUrl || source.book_source_url);
        if (!url) {
            console.log(`[搜索] ${sourceName}: 无搜索URL`);
            return [];
        }
        try {
            const html = await (0, targetAccess_1.requestTargetHtml)(url, this.headers, this.withRequestOptions(option));
            let ruleSearch;
            try {
                ruleSearch = typeof source.rule_search === 'string'
                    ? JSON.parse(source.rule_search)
                    : (source.rule_search || source.ruleSearch || {});
            }
            catch (parseErr) {
                console.log(`[搜索] ${sourceName}: rule_search解析失败 - ${parseErr.message}`);
                return [];
            }
            if (!ruleSearch.bookList) {
                console.log(`[搜索] ${sourceName}: 无bookList规则`);
                return [];
            }
            let results = this.parseSearchResult(html, ruleSearch, source, keyword);
            if (results.length === 0 && (0, targetAccess_1.isJinaMarkdownSnapshot)(html)) {
                results = this.parseMarkdownSearchResult(html, source, keyword);
            }
            console.log(`[搜索] ${sourceName}: 返回 ${results.length} 条结果`);
            return results;
        }
        catch (e) {
            console.error(`[搜索失败] ${sourceName}:`, e.message);
            return [];
        }
    }
    parseSearchResult(html, rule, source, keyword) {
        const results = [];
        const bookListRule = normalizeBookListRule(rule.bookList || '');
        if (!bookListRule)
            return results;
        let isJson = false;
        try {
            JSON.parse(html);
            isJson = true;
        }
        catch {
            isJson = false;
        }
        let bookElements = [];
        if (isJson && (bookListRule.startsWith('$.') || bookListRule.startsWith('$['))) {
            try {
                const jsonData = JSON.parse(html);
                const jsonResults = (0, jsonpath_plus_1.JSONPath)({ path: bookListRule, json: jsonData, wrap: true });
                let flat = [];
                for (const r of jsonResults) {
                    if (Array.isArray(r))
                        flat.push(...r);
                    else
                        flat.push(r);
                }
                bookElements = flat;
            }
            catch (e) {
                console.error('[JSON解析错误]', e);
                return results;
            }
        }
        else {
            const $ = cheerio.load(html);
            const elements = parseLegadoRule(bookListRule, $);
            elements.each((_, el) => {
                const elHtml = $.html(el) || $(el).html() || '';
                bookElements.push(elHtml);
            });
        }
        for (const elementData of bookElements) {
            const elementHtml = typeof elementData === 'string' ? elementData : JSON.stringify(elementData);
            const book = {
                name: '', author: '', bookUrl: '', coverUrl: '', intro: '',
                kind: '', latestChapterTitle: '', wordCount: '',
                origin: source.book_source_url || source.bookSourceUrl || '',
                originName: source.book_source_name || source.bookSourceName || '',
                type: source.book_source_type || source.bookSourceType || 0,
            };
            if (rule.name) {
                const r = executeRule(renderJsonTemplate(rule.name, elementData), elementHtml, isJson);
                if (r.length > 0)
                    book.name = r[0];
            }
            if (rule.author) {
                const r = executeRule(renderJsonTemplate(rule.author, elementData), elementHtml, isJson);
                if (r.length > 0)
                    book.author = r[0];
            }
            if (rule.coverUrl) {
                const r = executeRule(renderJsonTemplate(rule.coverUrl, elementData), elementHtml, isJson);
                if (r.length > 0)
                    book.coverUrl = r[0];
            }
            if (rule.intro) {
                const r = executeRule(renderJsonTemplate(rule.intro, elementData), elementHtml, isJson);
                if (r.length > 0)
                    book.intro = r[0];
            }
            if (rule.kind) {
                const r = executeRule(renderJsonTemplate(rule.kind, elementData), elementHtml, isJson);
                if (r.length > 0)
                    book.kind = r.join(',');
            }
            if (rule.lastChapter) {
                const r = executeRule(renderJsonTemplate(rule.lastChapter, elementData), elementHtml, isJson);
                if (r.length > 0)
                    book.latestChapterTitle = r[0];
            }
            if (rule.bookUrl) {
                const urls = executeRule(renderJsonTemplate(rule.bookUrl, elementData), elementHtml, isJson);
                if (urls.length > 0) {
                    let bookUrl = urls[0];
                    if (bookUrl && !bookUrl.startsWith('http')) {
                        const base = source.book_source_url || source.bookSourceUrl || '';
                        try {
                            bookUrl = new URL(bookUrl, base.split('#')[0]).href;
                        }
                        catch {
                            bookUrl = base + bookUrl;
                        }
                    }
                    book.bookUrl = bookUrl;
                }
            }
            if (book.name && book.bookUrl) {
                // 如果提供了关键词，进行智能匹配过滤
                if (keyword) {
                    // 规范化关键词与书名：去除空白、标点，统一小写
                    const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
                    const kw = normalize(keyword);
                    const nameClean = normalize(book.name);
                    const authorClean = normalize(book.author);
                    // 1. 强匹配：书名或作者 **完整包含** 关键词（连续子串）——优先放行
                    const strictNameMatch = nameClean.includes(kw);
                    const strictAuthorMatch = authorClean.includes(kw);
                    // 2. 反向匹配：关键词本身包含完整书名（如搜"斗破苍穹"，书名"斗破"是其前缀）
                    const reverseMatch = kw.length > nameClean.length
                        && nameClean.length >= 2
                        && kw.includes(nameClean);
                    // 3. 前缀/首词匹配：书名以关键词开头（典型"精确搜"场景）
                    const prefixMatch = nameClean.startsWith(kw) && kw.length >= 2;
                    // 4. 宽匹配（兜底，门槛显著提高）
                    //    - 关键词长度 >= 4 才启用
                    //    - 书名必须含有 **连续的子串**（长度 ≥ 关键词的 70%）
                    //    - 不再使用"散字逐字"匹配，避免"夜无疆"命中"火神庙夜祭"这类错书
                    let fuzzyMatch = false;
                    if (kw.length >= 4 && !strictNameMatch && !prefixMatch) {
                        const minLen = Math.max(2, Math.floor(kw.length * 0.7));
                        for (let i = 0; i <= kw.length - minLen; i++) {
                            const sub = kw.slice(i, i + minLen);
                            if (nameClean.includes(sub)) {
                                fuzzyMatch = true;
                                break;
                            }
                        }
                    }
                    if (strictNameMatch || strictAuthorMatch || reverseMatch || prefixMatch || fuzzyMatch) {
                        results.push(book);
                    }
                }
                else {
                    results.push(book);
                }
            }
        }
        return results;
    }
    parseMarkdownSearchResult(html, source, keyword) {
        const links = (0, targetAccess_1.extractJinaMarkdownLinks)(html);
        const sourceUrl = source.book_source_url || source.bookSourceUrl || '';
        const sourceName = source.book_source_name || source.bookSourceName || '';
        const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
        const keywordText = normalize(keyword || '');
        const seen = new Set();
        const results = [];
        for (const link of links) {
            if (!/\/Book\/\d+\/?$/i.test(link.url))
                continue;
            const cleanName = link.title.replace(/[（(]\d{2}-\d{2}[）)]$/, '').trim();
            if (!cleanName || (keywordText && !normalize(cleanName).includes(keywordText) && !keywordText.includes(normalize(cleanName))))
                continue;
            if (seen.has(link.url))
                continue;
            seen.add(link.url);
            results.push({
                name: cleanName,
                author: '',
                bookUrl: link.url,
                coverUrl: '',
                intro: '',
                kind: '',
                latestChapterTitle: '',
                wordCount: '',
                origin: sourceUrl,
                originName: sourceName,
                type: source.book_source_type || source.bookSourceType || 0,
            });
        }
        return results;
    }
    async getBookInfo(source, bookUrl) {
        this.initHeaders(source);
        try {
            const html = await this.fetchTargetHtml(bookUrl);
            const ruleInfo = typeof source.rule_book_info === 'string'
                ? JSON.parse(source.rule_book_info)
                : (source.rule_book_info || source.ruleBookInfo || {});
            const info = {};
            if (ruleInfo.name) {
                const r = executeRule(ruleInfo.name, html);
                if (r.length > 0)
                    info.name = r[0];
            }
            if (ruleInfo.author) {
                const r = executeRule(ruleInfo.author, html);
                if (r.length > 0)
                    info.author = r[0];
            }
            if (ruleInfo.coverUrl) {
                const r = executeRule(ruleInfo.coverUrl, html);
                if (r.length > 0)
                    info.coverUrl = r[0];
            }
            if (ruleInfo.intro) {
                const r = executeRule(ruleInfo.intro, html);
                if (r.length > 0)
                    info.intro = r[0];
            }
            if (ruleInfo.kind) {
                const r = executeRule(ruleInfo.kind, html);
                if (r.length > 0)
                    info.kind = r.join(',');
            }
            if (ruleInfo.lastChapter) {
                const r = executeRule(ruleInfo.lastChapter, html);
                if (r.length > 0)
                    info.latestChapterTitle = r[0];
            }
            if (ruleInfo.wordCount) {
                const r = executeRule(ruleInfo.wordCount, html);
                if (r.length > 0)
                    info.wordCount = r[0];
            }
            const tocTarget = this.extractTocTargetFromBookInfo(source, html, bookUrl);
            if (tocTarget)
                info.tocUrl = tocTarget.url;
            return info;
        }
        catch (e) {
            console.error(`[获取详情失败] ${source.book_source_name}:`, e.message);
            return {};
        }
    }
    async getChapterList(source, book) {
        this.initHeaders(source);
        const bookUrl = book.book_url || book.bookUrl || book.toc_url || book.tocUrl;
        const rawTocUrl = book.toc_url || book.tocUrl || '';
        try {
            let tocTarget = this.normalizeTargetUrl(rawTocUrl || bookUrl, bookUrl);
            if (!tocTarget)
                return [];
            const ruleInfo = typeof source.rule_book_info === 'string'
                ? JSON.parse(source.rule_book_info)
                : (source.rule_book_info || source.ruleBookInfo || {});
            if (ruleInfo.tocUrl && (!rawTocUrl || tocTarget.url === bookUrl)) {
                const detailHtml = await this.fetchTargetHtml(bookUrl);
                const resolvedTocTarget = this.extractTocTargetFromBookInfo(source, detailHtml, bookUrl);
                if (resolvedTocTarget && resolvedTocTarget.url !== bookUrl) {
                    tocTarget = resolvedTocTarget;
                }
                else {
                    const ruleToc = typeof source.rule_toc === 'string'
                        ? JSON.parse(source.rule_toc)
                        : (source.rule_toc || source.ruleToc || {});
                    const detailChapters = this.parseChapterList(detailHtml, ruleToc, bookUrl);
                    if (detailChapters.length > 0 || !(0, targetAccess_1.isJinaMarkdownSnapshot)(detailHtml))
                        return detailChapters;
                    return this.parseMarkdownChapterList(detailHtml);
                }
            }
            const html = await this.fetchTargetHtml(tocTarget.url, tocTarget.option);
            const ruleToc = typeof source.rule_toc === 'string'
                ? JSON.parse(source.rule_toc)
                : (source.rule_toc || source.ruleToc || {});
            const chapters = this.parseChapterList(html, ruleToc, tocTarget.url);
            return chapters.length === 0 && (0, targetAccess_1.isJinaMarkdownSnapshot)(html)
                ? this.parseMarkdownChapterList(html)
                : chapters;
        }
        catch (e) {
            console.error(`[获取目录失败] ${source.book_source_name}:`, e.message);
            return [];
        }
    }
    parseChapterList(html, rule, baseUrl) {
        const $ = cheerio.load(html);
        const results = [];
        const chapterListRule = rule.chapterList || '';
        if (!chapterListRule)
            return results;
        const elements = parseLegadoRule(chapterListRule, $);
        elements.each((index, el) => {
            const chapter = { index, title: '', url: '' };
            const el$ = $(el);
            // Handle chapterName: could be a plain attribute like 'text', 'href'
            // or a selector like 'tag.a@text'
            if (rule.chapterName) {
                const nameRule = rule.chapterName.trim();
                // If the rule is just an attribute suffix (text, href, src, etc.), extract directly
                const knownAttrs = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
                    'data-original', 'data-src', 'content', 'title'];
                if (knownAttrs.includes(nameRule) || nameRule.startsWith('attr.') || nameRule.startsWith('data-')) {
                    chapter.title = getResultFromElement(el, $, nameRule);
                }
                else if (nameRule.includes('@') || nameRule.includes('.') || nameRule.includes('#')) {
                    // It's a selector rule, use parseLegadoRule
                    const nameResult = parseLegadoRule(nameRule, $, el);
                    if (typeof nameResult === 'string') {
                        chapter.title = nameResult;
                    }
                    else if (nameResult.length > 0) {
                        chapter.title = $(nameResult[0]).text().trim() || $(nameResult[0]).attr('title') || '';
                    }
                }
                else {
                    // Fallback: try as text content
                    chapter.title = el$.text().trim();
                }
            }
            // Handle chapterUrl similarly
            if (rule.chapterUrl) {
                const urlRule = rule.chapterUrl.trim();
                const knownAttrs = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
                    'data-original', 'data-src', 'content', 'title'];
                let url = '';
                if (knownAttrs.includes(urlRule) || urlRule.startsWith('attr.') || urlRule.startsWith('data-')) {
                    url = getResultFromElement(el, $, urlRule);
                }
                else if (urlRule.includes('@') || urlRule.includes('.') || urlRule.includes('#')) {
                    const urlResult = parseLegadoRule(urlRule, $, el);
                    if (typeof urlResult === 'string') {
                        url = urlResult;
                    }
                    else if (urlResult.length > 0) {
                        url = $(urlResult[0]).attr('href') || '';
                    }
                }
                else {
                    url = el$.attr('href') || '';
                }
                if (url && !url.startsWith('http')) {
                    try {
                        url = new URL(url, baseUrl).href;
                    }
                    catch {
                        url = baseUrl + url;
                    }
                }
                chapter.url = url;
            }
            if (chapter.title)
                results.push(chapter);
        });
        return results.map((ch, i) => ({ ...ch, index: i }));
    }
    parseMarkdownChapterList(html) {
        const seen = new Set();
        const chapters = [];
        for (const link of (0, targetAccess_1.extractJinaMarkdownLinks)(html)) {
            if (!/\/Partlist\/\d+\/\d+\.shtml$/i.test(link.url))
                continue;
            if (seen.has(link.url))
                continue;
            seen.add(link.url);
            chapters.push({ index: chapters.length, title: link.title, url: link.url });
        }
        return chapters;
    }
    async getContent(source, book, chapter) {
        this.initHeaders(source);
        const contentUrl = chapter.url;
        if (!contentUrl)
            return null;
        try {
            const html = await (0, targetAccess_1.requestTargetHtml)(contentUrl, this.headers, this.withRequestOptions());
            const ruleContent = typeof source.rule_content === 'string'
                ? JSON.parse(source.rule_content)
                : (source.rule_content || source.ruleContent || {});
            if ((0, targetAccess_1.isJinaMarkdownSnapshot)(html)) {
                return (0, targetAccess_1.extractJinaMarkdownText)(html) || null;
            }
            return this.parseContent(html, ruleContent, contentUrl);
        }
        catch (e) {
            console.error(`[获取内容失败] ${source.book_source_name}:`, e.message);
            return null;
        }
    }
    async parseContent(html, rule, baseUrl, visited = new Set()) {
        let contents = rule.content ? executeRule(rule.content, html) : [];
        if (contents.length === 0) {
            const $ = cheerio.load(html);
            const fallbackSelectors = [
                '#ChapterContents',
                '#chaptercontent',
                '#content',
                '.page-content',
                '.read-content',
                '.reader-content',
                '.chapter-content',
                '.content',
            ];
            for (const selector of fallbackSelectors) {
                const node = $(selector).first();
                const text = node.text().trim();
                if (text.length > 100) {
                    contents = [node.html() || text];
                    break;
                }
            }
        }
        if (contents.length === 0)
            return null;
        let content = contents.join('\n');
        const nextUrls = rule.nextContentUrl && visited.size < 8
            ? (0, contentPagination_1.normalizeNextContentUrls)(executeRule(rule.nextContentUrl, html), baseUrl).filter(url => !visited.has(url))
            : [];
        if (nextUrls.length) {
            visited.add(baseUrl);
            const nextContents = [];
            if (nextUrls.length === 1) {
                let nextUrl = nextUrls[0];
                while (nextUrl && !visited.has(nextUrl) && visited.size < 8) {
                    visited.add(nextUrl);
                    const nextHtml = await (0, targetAccess_1.requestTargetHtml)(nextUrl, this.headers, this.withRequestOptions());
                    const nextContent = await this.parseContent(nextHtml, rule, nextUrl, visited);
                    if (nextContent)
                        nextContents.push(nextContent);
                    const candidates = (0, contentPagination_1.normalizeNextContentUrls)(executeRule(rule.nextContentUrl, nextHtml), nextUrl)
                        .filter(url => !visited.has(url));
                    nextUrl = candidates[0] || '';
                }
            }
            else {
                const pages = await Promise.allSettled(nextUrls.slice(0, 8).map(async (nextUrl) => {
                    visited.add(nextUrl);
                    const nextHtml = await (0, targetAccess_1.requestTargetHtml)(nextUrl, this.headers, this.withRequestOptions());
                    return this.parseContent(nextHtml, { ...rule, nextContentUrl: '' }, nextUrl, visited);
                }));
                for (const page of pages) {
                    if (page.status === 'fulfilled' && page.value)
                        nextContents.push(page.value);
                }
            }
            if (nextContents.length) {
                content = [content, ...nextContents].join('\n');
            }
        }
        content = content.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                try {
                    return match.replace(src, new URL(src, baseUrl).href);
                }
                catch {
                    return match;
                }
            }
            return match;
        });
        if (rule.replaceRegex) {
            const replaces = Array.isArray(rule.replaceRegex) ? rule.replaceRegex : [rule.replaceRegex];
            for (const r of replaces) {
                try {
                    const regex = new RegExp(r.pattern, r.flags || 'g');
                    content = content.replace(regex, r.replacement || '');
                }
                catch { /* ignore */ }
            }
        }
        return (0, contentCleaner_1.cleanContent)(content);
    }
}
exports.WebBookEngine = WebBookEngine;
exports.webBookEngine = new WebBookEngine();
//# sourceMappingURL=webBookService.js.map