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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSearchActionTemplate = extractSearchActionTemplate;
exports.detectAccessChallenge = detectAccessChallenge;
exports.extractApiCandidatesFromHtml = extractApiCandidatesFromHtml;
exports.inferJsonSearchRule = inferJsonSearchRule;
exports.buildSearchCandidates = buildSearchCandidates;
exports.inferSearchRulesFromHtml = inferSearchRulesFromHtml;
exports.buildDefaultSource = buildDefaultSource;
exports.buildApiSource = buildApiSource;
exports.buildFallbackGenerationResult = buildFallbackGenerationResult;
exports.buildHeaderProfiles = buildHeaderProfiles;
exports.generateBookSource = generateBookSource;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const httpAgent_1 = require("./httpAgent");
function normalizeBaseUrl(url) {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.toString().replace(/\/$/, '');
}
function joinUrl(baseUrl, path) {
    return new URL(path, `${normalizeBaseUrl(baseUrl)}/`).toString();
}
function toRelativeTemplate(baseUrl, urlTemplate) {
    const normalized = urlTemplate
        .replace('{keyword}', '{{key}}')
        .replace('{key}', '{{key}}')
        .replace('{search_term_string}', '{{key}}')
        .replace('%7Bsearch_term_string%7D', '{{key}}');
    const parsed = new URL(normalized, `${normalizeBaseUrl(baseUrl)}/`);
    return `${parsed.pathname}${parsed.search}` || '/';
}
function findUrlTemplate(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    if (typeof record.urlTemplate === 'string')
        return record.urlTemplate;
    if (typeof record.target === 'string')
        return record.target;
    if (record.target && typeof record.target === 'object') {
        const fromTarget = findUrlTemplate(record.target);
        if (fromTarget)
            return fromTarget;
    }
    for (const child of Object.values(record)) {
        if (Array.isArray(child)) {
            for (const item of child) {
                const found = findUrlTemplate(item);
                if (found)
                    return found;
            }
        }
        else {
            const found = findUrlTemplate(child);
            if (found)
                return found;
        }
    }
    return null;
}
function extractSearchActionTemplate(baseUrl, html) {
    const $ = cheerio.load(html);
    for (const element of $('script[type="application/ld+json"]').toArray()) {
        const text = $(element).html()?.trim();
        if (!text || !text.includes('SearchAction'))
            continue;
        try {
            const data = JSON.parse(text);
            const template = findUrlTemplate(data);
            if (template)
                return toRelativeTemplate(baseUrl, template);
        }
        catch {
            const match = text.match(/"urlTemplate"\s*:\s*"([^"]+)"/);
            if (match)
                return toRelativeTemplate(baseUrl, match[1].replace(/\\\//g, '/'));
        }
    }
    const form = $('form[action*="search"]').first();
    const action = form.attr('action');
    const inputName = form.find('input[name]').first().attr('name');
    if (action && inputName) {
        const parsed = new URL(action, `${normalizeBaseUrl(baseUrl)}/`);
        parsed.searchParams.set(inputName, '{{key}}');
        return `${parsed.pathname}${parsed.search}`;
    }
    return null;
}
function detectAccessChallenge(html) {
    const normalized = html.toLowerCase();
    if (html.includes('<title>访问验证</title>') || html.includes('请完成访问验证')) {
        return '访问验证';
    }
    if (normalized.includes('<title>just a moment...</title>') || normalized.includes('cf_chl_opt')) {
        return 'Cloudflare 访问验证';
    }
    if (normalized.includes('enable javascript and cookies to continue')) {
        return '访问验证';
    }
    return null;
}
function normalizeApiTemplate(raw) {
    if (!raw || raw.length > 300)
        return null;
    let value = raw
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .trim();
    if (!/^https?:\/\//i.test(value) && !value.startsWith('/'))
        return null;
    if (!/(api|search|so|book|novel|rank|chapter)/i.test(value))
        return null;
    value = value.replace(/([?&](?:keyword|key|searchkey|q|wd|name)=)([^&"'`\s]*)/i, '$1{{key}}');
    if (!value.includes('{{key}}') && /search|so/i.test(value)) {
        value += value.includes('?') ? '&keyword={{key}}' : '?keyword={{key}}';
    }
    try {
        const parsed = new URL(value, 'https://placeholder.local');
        return `${parsed.pathname}${parsed.search}`;
    }
    catch {
        return null;
    }
}
function extractApiCandidatesFromHtml(baseUrl, html) {
    const $ = cheerio.load(html);
    const candidates = new Set();
    const searchAction = extractSearchActionTemplate(baseUrl, html);
    if (searchAction)
        candidates.add(searchAction);
    const scriptText = $('script').map((_, element) => $(element).html() || '').get().join('\n');
    const concatenatedPattern = /["'`](\/[^"'`]+?(?:api|search|so|book|novel|rank|chapter)[^"'`]*?=)["'`]\s*\+\s*(?:encodeURIComponent\()?keyword\)?\s*(?:\+\s*["'`]([^"'`]*)["'`])?/gi;
    for (const match of scriptText.matchAll(concatenatedPattern)) {
        const normalized = normalizeApiTemplate(`${match[1]}{{key}}${match[2] || ''}`);
        if (normalized)
            candidates.add(normalized);
    }
    const patterns = [
        /["'`](https?:\/\/[^"'`]+?(?:api|search|so|book|novel|rank|chapter)[^"'`]*)["'`]/gi,
        /["'`](\/[^"'`]+?(?:api|search|so|book|novel|rank|chapter)[^"'`]*)["'`]/gi,
    ];
    for (const pattern of patterns) {
        for (const match of scriptText.matchAll(pattern)) {
            const normalized = normalizeApiTemplate(match[1]);
            if (normalized)
                candidates.add(normalized);
        }
    }
    return Array.from(candidates);
}
function findArrayPath(value, path = '$') {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        return { path: `${path}[*]`, item: value[0] };
    }
    if (!value || typeof value !== 'object')
        return null;
    for (const key of ['data', 'list', 'items', 'result', 'records', 'rows', 'books', 'novels']) {
        if (key in value) {
            const found = findArrayPath(value[key], `${path}.${key}`);
            if (found)
                return found;
        }
    }
    for (const [key, child] of Object.entries(value)) {
        const found = findArrayPath(child, `${path}.${key}`);
        if (found)
            return found;
    }
    return null;
}
function pickJsonField(item, names) {
    const lowerMap = new Map(Object.keys(item).map((key) => [key.toLowerCase(), key]));
    for (const name of names) {
        const exact = lowerMap.get(name.toLowerCase());
        if (exact)
            return `$.${exact}`;
    }
    return '';
}
function inferJsonSearchRule(payload) {
    const found = findArrayPath(payload);
    if (!found || !found.item || typeof found.item !== 'object') {
        return {
            bookList: '$.data[*]',
            name: '$.name',
            author: '$.author',
            bookUrl: '$.url',
            coverUrl: '',
            intro: '',
            kind: '',
            lastChapter: '',
            wordCount: '',
        };
    }
    const item = found.item;
    const idField = pickJsonField(item, ['novelId', 'bookId', 'id', 'articleId']);
    return {
        bookList: found.path,
        name: pickJsonField(item, ['novelName', 'bookName', 'name', 'title']),
        author: pickJsonField(item, ['authorName', 'author', 'writer']),
        bookUrl: idField ? `/novel/{{${idField}}}` : pickJsonField(item, ['bookUrl', 'url', 'path']),
        coverUrl: pickJsonField(item, ['cover', 'coverUrl', 'pic', 'image']),
        intro: pickJsonField(item, ['summary', 'intro', 'description', 'desc']),
        kind: pickJsonField(item, ['categoryName', 'categoryNames', 'className', 'kind']),
        lastChapter: pickJsonField(item, ['lastChapterName', 'lastChapter', 'latestChapter']),
        wordCount: pickJsonField(item, ['wordNum', 'wordCount', 'words']),
    };
}
function buildSearchCandidates(baseUrl, keyword, extraTemplates = []) {
    const encoded = encodeURIComponent(keyword);
    const templates = Array.from(new Set([
        ...extraTemplates,
        '/search?keyword={{key}}',
        '/search.html?keyword={{key}}',
        '/search.php?keyword={{key}}',
        '/search.php?searchkey={{key}}',
        '/modules/article/search.php?searchkey={{key}}&searchtype=articlename',
        '/modules/article/search.php?searchkey={{key}}',
        '/e/search/index.php?keyboard={{key}}',
        '/plus/search.php?keyword={{key}}',
    ]));
    return templates.map((template) => ({
        template,
        url: joinUrl(baseUrl, template.replace('{{key}}', encoded)),
    }));
}
function inferSearchRulesFromHtml(html) {
    const $ = cheerio.load(html);
    const candidates = [
        { selector: '.book-list li', score: $('.book-list li a[href]').length },
        { selector: '.result li', score: $('.result li a[href]').length },
        { selector: '.search-list li', score: $('.search-list li a[href]').length },
        { selector: '.grid tr', score: $('.grid tr a[href]').length },
        { selector: 'tbody tr', score: $('tbody tr a[href]').length },
        { selector: 'li', score: $('li a[href]').length },
    ].filter((item) => item.score >= 2);
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (!best) {
        return {
            bookList: 'li',
            name: 'a@text',
            author: '',
            bookUrl: 'a@href',
            coverUrl: '',
            intro: '',
            kind: '',
            lastChapter: '',
        };
    }
    const first = $(best.selector).first();
    const authorSelectors = ['.author', '.book-author', '.s2', 'span'].filter((selector) => first.find(selector).length > 0);
    return {
        bookList: best.selector,
        name: 'a@text',
        author: authorSelectors.length > 0 ? `${authorSelectors[0]}@text` : '',
        bookUrl: 'a@href',
        coverUrl: first.find('img').length > 0 ? 'img@src' : '',
        intro: first.find('.intro,.desc,.description').length > 0 ? '.intro@text||.desc@text||.description@text' : '',
        kind: '',
        lastChapter: '',
    };
}
function buildDefaultSource(input) {
    const baseUrl = normalizeBaseUrl(input.url);
    return {
        bookSourceName: input.name,
        bookSourceType: 0,
        bookSourceUrl: baseUrl,
        customOrder: 0,
        enabled: true,
        enabledCookieJar: true,
        enabledExplore: false,
        exploreUrl: '',
        header: JSON.stringify({
            'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            referer: '{{baseUrl}}',
        }, null, 2),
        lastUpdateTime: Date.now(),
        respondTime: 0,
        searchUrl: input.searchUrl,
        ruleSearch: {
            bookList: input.ruleSearch.bookList,
            name: input.ruleSearch.name,
            author: input.ruleSearch.author,
            bookUrl: input.ruleSearch.bookUrl,
            coverUrl: input.ruleSearch.coverUrl || '',
            intro: input.ruleSearch.intro || '',
            kind: input.ruleSearch.kind || '',
            lastChapter: input.ruleSearch.lastChapter || '',
            wordCount: '',
        },
        ruleBookInfo: {
            name: 'h1@text||.book-title@text||.title@text',
            author: '.author@text||.book-author@text',
            intro: '#intro@text||.intro@text||.desc@text',
            kind: '.tag@text||.category@text',
            lastChapter: '.lastChapter@text||.newestChapter@text',
            coverUrl: 'img@src',
            tocUrl: '',
            wordCount: '',
        },
        ruleToc: {
            chapterList: 'dd a',
            chapterName: 'text',
            chapterUrl: 'href',
            nextTocUrl: '',
            isPay: '',
        },
        ruleContent: {
            content: '#content@html||.content@html||.chapter-content@html',
            nextContentUrl: '',
        },
        weight: 0,
    };
}
function normalizeHeaders(headers) {
    const normalized = {};
    for (const [key, value] of Object.entries(headers || {})) {
        const headerName = key.trim();
        if (!headerName || /[\r\n:]/.test(headerName))
            continue;
        if (typeof value !== 'string')
            continue;
        normalized[headerName] = value.trim();
    }
    return normalized;
}
function buildApiSource(input) {
    const source = buildDefaultSource({
        url: input.url,
        name: input.name,
        searchUrl: input.searchUrl,
        ruleSearch: input.ruleSearch,
    });
    const headers = normalizeHeaders({
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: '{{baseUrl}}',
        Origin: '{{baseUrl}}',
        ...input.headers,
    });
    source.header = JSON.stringify(headers, null, 2);
    source.ruleBookInfo = {
        name: input.ruleSearch.name || '$.name',
        author: input.ruleSearch.author || '$.author',
        intro: input.ruleSearch.intro || '$.intro',
        kind: input.ruleSearch.kind || '',
        lastChapter: input.ruleSearch.lastChapter || '',
        coverUrl: input.ruleSearch.coverUrl || '',
        tocUrl: '',
        wordCount: input.ruleSearch.wordCount || '',
    };
    source.ruleToc = {
        chapterList: '$.data.list[*]||$.data[*]||$.list[*]',
        chapterName: '$.chapterName||$.name||$.title',
        chapterUrl: '$.chapterUrl||$.url||$.path',
        nextTocUrl: '',
        isPay: '',
    };
    source.ruleContent = {
        content: '$.content',
        nextContentUrl: '',
    };
    return source;
}
function buildFallbackGenerationResult(input) {
    const baseUrl = normalizeBaseUrl(input.url);
    const sourceName = input.name?.trim() || new URL(baseUrl).hostname.replace(/^www\./, '');
    const source = buildDefaultSource({
        url: baseUrl,
        name: sourceName,
        searchUrl: '/search?keyword={{key}}',
        ruleSearch: inferSearchRulesFromHtml(''),
    });
    return {
        source,
        jsonText: JSON.stringify(source, null, 2),
        diagnostics: [
            `站点探测失败，已生成基础书源 JSON 草稿，需要手动调整搜索、目录和正文规则。${input.reason ? `原因：${input.reason}` : ''}`,
        ],
    };
}
const DEFAULT_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};
function buildHeaderProfiles(url, customHeaders) {
    const parsed = new URL(url);
    const referer = url;
    const origin = `${parsed.protocol}//${parsed.host}`;
    const baseHeaders = {
        Accept: 'application/json, text/plain, */*',
        Referer: referer,
        Origin: origin,
    };
    const profiles = [
        {
            name: '移动端浏览器',
            headers: {
                ...baseHeaders,
                'User-Agent': DEFAULT_REQUEST_HEADERS['User-Agent'],
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        },
        {
            name: '桌面浏览器',
            headers: {
                ...baseHeaders,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        },
        {
            name: 'AJAX 请求',
            headers: {
                ...baseHeaders,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
            },
        },
        {
            name: 'App okhttp',
            headers: {
                ...baseHeaders,
                'User-Agent': 'okhttp/4.9.2',
                'client-source': 'android',
            },
        },
    ];
    const normalizedCustom = normalizeHeaders(customHeaders);
    if (Object.keys(normalizedCustom).length > 0) {
        return [
            {
                name: '自定义请求头',
                headers: normalizeHeaders({ ...profiles[0].headers, ...normalizedCustom }),
            },
            ...profiles.map((profile) => ({ ...profile, headers: normalizeHeaders(profile.headers) })),
        ];
    }
    return profiles.map((profile) => ({ ...profile, headers: normalizeHeaders(profile.headers) }));
}
async function fetchText(url, headers) {
    const agent = (0, httpAgent_1.getAgentForUrl)(url);
    const response = await axios_1.default.get(url, {
        timeout: 15000,
        responseType: 'text',
        httpAgent: agent,
        httpsAgent: agent,
        headers: normalizeHeaders({ ...DEFAULT_REQUEST_HEADERS, ...headers }),
        validateStatus: (status) => status >= 200 && status < 400,
    });
    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const challenge = detectAccessChallenge(html);
    if (challenge) {
        throw new Error(challenge);
    }
    return html;
}
async function fetchJson(url, headers) {
    const text = await fetchText(url, {
        Accept: 'application/json, text/plain, */*',
        ...headers,
    });
    return JSON.parse(text);
}
function inferNameFromHome(url, html, fallback) {
    if (fallback && fallback.trim())
        return fallback.trim();
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim().replace(/[-_].*$/, '').trim();
    if (title)
        return title;
    return new URL(url).hostname.replace(/^www\./, '');
}
async function generateApiBookSource(input, homeHtml, sourceName, initialDiagnostics = []) {
    const keyword = input.keyword?.trim() || '诡秘之主';
    const baseUrl = normalizeBaseUrl(input.url);
    const diagnostics = [
        '已启用 API 探测模式：仅探测页面暴露的公开接口，不绕过登录、签名或访问验证。',
        ...initialDiagnostics,
    ];
    const apiTemplates = Array.from(new Set([
        ...extractApiCandidatesFromHtml(baseUrl, homeHtml),
        ...buildSearchCandidates(baseUrl, keyword).map((item) => item.template),
    ]));
    const headerProfiles = buildHeaderProfiles(baseUrl, input.headers);
    for (const template of apiTemplates) {
        const candidateUrl = joinUrl(baseUrl, template.replace('{{key}}', encodeURIComponent(keyword)));
        for (const profile of headerProfiles) {
            try {
                const payload = await fetchJson(candidateUrl, profile.headers);
                const ruleSearch = inferJsonSearchRule(payload);
                if (!ruleSearch.bookList || ruleSearch.bookList === '$.data[*]' && !JSON.stringify(payload).includes(keyword)) {
                    diagnostics.push(`接口候选返回 JSON，但未稳定识别搜索列表：${template}（${profile.name}）`);
                    continue;
                }
                const source = buildApiSource({
                    url: baseUrl,
                    name: sourceName,
                    searchUrl: template,
                    headers: profile.headers,
                    ruleSearch,
                });
                diagnostics.push(`已命中 JSON API 搜索接口：${template}（${profile.name}）`);
                return {
                    source,
                    jsonText: JSON.stringify(source, null, 2),
                    diagnostics,
                };
            }
            catch (error) {
                diagnostics.push(`API 候选不可用：${template}（${profile.name}：${error.message}）`);
            }
        }
    }
    const fallback = buildFallbackGenerationResult({
        url: baseUrl,
        name: sourceName,
        reason: '未发现可直接访问的公开 JSON 搜索 API',
    });
    return {
        ...fallback,
        diagnostics: [...diagnostics, ...fallback.diagnostics],
    };
}
async function generateBookSource(input) {
    const keyword = input.keyword?.trim() || '诡秘之主';
    const diagnostics = [];
    const baseUrl = normalizeBaseUrl(input.url);
    let homeHtml = '';
    if (input.mode === 'api') {
        const headerProfiles = buildHeaderProfiles(baseUrl, input.headers);
        for (const profile of headerProfiles) {
            try {
                homeHtml = await fetchText(baseUrl, profile.headers);
                diagnostics.push(`首页探测成功：${profile.name}`);
                break;
            }
            catch (error) {
                diagnostics.push(`首页探测失败：${profile.name}（${error.message}）`);
            }
        }
        if (!homeHtml) {
            const fallback = buildFallbackGenerationResult({
                url: baseUrl,
                name: input.name,
                reason: '所有请求头模板都无法访问首页',
            });
            return {
                ...fallback,
                diagnostics: [
                    '已启用 API 探测模式：仅探测页面暴露的公开接口，不绕过登录、签名或访问验证。',
                    ...diagnostics,
                    ...fallback.diagnostics,
                ],
            };
        }
    }
    else {
        try {
            homeHtml = await fetchText(baseUrl);
        }
        catch (error) {
            return buildFallbackGenerationResult({
                url: baseUrl,
                name: input.name,
                reason: error.message,
            });
        }
    }
    const sourceName = inferNameFromHome(baseUrl, homeHtml, input.name);
    if (input.mode === 'api') {
        return generateApiBookSource(input, homeHtml, sourceName, diagnostics);
    }
    const detectedTemplate = extractSearchActionTemplate(baseUrl, homeHtml);
    let selectedTemplate = detectedTemplate || '/search?keyword={{key}}';
    let ruleSearch = inferSearchRulesFromHtml('');
    if (detectedTemplate) {
        diagnostics.push(`已从首页 SearchAction 识别搜索地址：${detectedTemplate}`);
    }
    for (const candidate of buildSearchCandidates(baseUrl, keyword, detectedTemplate ? [detectedTemplate] : [])) {
        try {
            const html = await fetchText(candidate.url);
            const inferred = inferSearchRulesFromHtml(html);
            if (inferred.bookList !== 'li' || html.includes(keyword)) {
                selectedTemplate = candidate.template;
                ruleSearch = inferred;
                diagnostics.push(`已使用搜索候选：${candidate.template}`);
                break;
            }
        }
        catch (error) {
            diagnostics.push(`搜索候选不可用：${candidate.template}（${error.message}）`);
        }
    }
    if (ruleSearch.bookList === 'li') {
        diagnostics.push('未能稳定识别搜索结果列表，已生成基础规则草稿，需要手动调整 ruleSearch。');
    }
    const source = buildDefaultSource({
        url: baseUrl,
        name: sourceName,
        searchUrl: selectedTemplate,
        ruleSearch,
    });
    return {
        source,
        jsonText: JSON.stringify(source, null, 2),
        diagnostics,
    };
}
//# sourceMappingURL=sourceGenerator.js.map