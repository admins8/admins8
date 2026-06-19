"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.escapeJsonForHtml = escapeJsonForHtml;
exports.loadSiteConfigMap = loadSiteConfigMap;
exports.renderSeoTemplate = renderSeoTemplate;
exports.buildRouteSeo = buildRouteSeo;
exports.injectSeoIntoHtml = injectSeoIntoHtml;
exports.renderFrontendHtml = renderFrontendHtml;
exports.syncStaticSeoShells = syncStaticSeoShells;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const publicSiteConfig_1 = require("./publicSiteConfig");
const aliases = {
    网站名: 'siteName',
    年份: 'year',
    书名: 'bookName',
    作者: 'author',
    简介: 'intro',
    分类: 'category',
    最新章节: 'latestChapter',
    章节名: 'chapterTitle',
    书源: 'sourceName',
    关键词: 'keyword',
    榜单名: 'rankName',
};
const defaults = {
    home_title: '{siteName}',
    home_keywords: '小说,免费小说,网络小说,小说搜索,{年份}',
    home_description: '{siteName}提供热门小说搜索、在线阅读和排行榜推荐。',
    detail_title_template: '{bookName}全文免费阅读_{bookName}最新章节_{siteName}',
    detail_keywords_template: '{bookName},{author},{bookName}最新章节,{bookName}全文阅读,{年份}',
    detail_description_template: '{bookName}是{author}创作的小说，最新章节：{latestChapter}。{intro}',
    reader_title_template: '{chapterTitle}_{bookName}全文阅读_{siteName}',
    reader_keywords_template: '{bookName},{chapterTitle},{author},免费阅读,{年份}',
    reader_description_template: '正在阅读{bookName}的{chapterTitle}，作者：{author}。',
    search_title_template: '{keyword}搜索结果_{siteName}',
    search_keywords_template: '{keyword},小说搜索,免费小说,{年份}',
    search_description_template: '在{siteName}搜索{keyword}，查看相关小说和可用书源。',
    ranking_title_template: '小说排行榜_{siteName}',
    ranking_keywords_template: '小说排行榜,热门小说,完本小说,免费小说,{年份}',
    ranking_description_template: '{siteName}提供热门小说排行榜、分类榜单和推荐书单。',
};
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeJsonForHtml(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
function cleanDomain(configs) {
    return String(configs.web_domain || process.env.SITE_URL || 'https://soumal.com').trim().replace(/\/+$/, '') || 'https://soumal.com';
}
function toConfigMap(items) {
    return items.reduce((map, item) => {
        map[item.config_key] = item.config_value || '';
        return map;
    }, {});
}
async function loadSiteConfigMap() {
    const configs = await (0, database_1.query)('SELECT config_key, config_value FROM site_config');
    return toConfigMap(configs);
}
function renderSeoTemplate(template, configs, vars = {}) {
    const year = String(new Date().getFullYear());
    const values = {
        siteName: configs.site_title || '搜书网',
        year,
        ...vars,
    };
    return String(template || '').replace(/\{([^{}]+)\}/g, (_, rawKey) => {
        const key = aliases[rawKey] || rawKey;
        const value = key === 'year' ? year : values[key];
        return String(value ?? '').trim();
    }).trim();
}
function readQuery(url, key) {
    return url.searchParams.get(key) || '';
}
function firstQuery(url, keys) {
    for (const key of keys) {
        const value = readQuery(url, key);
        if (value)
            return value;
    }
    return '';
}
function routeVars(url, extraVars = {}) {
    return {
        keyword: firstQuery(url, ['keyword', 'q', 'wd', 'search']),
        bookName: firstQuery(url, ['bookName', 'name']),
        author: readQuery(url, 'author'),
        intro: readQuery(url, 'intro'),
        category: readQuery(url, 'category') || '全部',
        latestChapter: firstQuery(url, ['latestChapter', 'latestChapterTitle']),
        chapterTitle: firstQuery(url, ['chapterTitle', 'title']),
        sourceName: readQuery(url, 'sourceName'),
        rankName: readQuery(url, 'rankName') || '小说排行榜',
        ...extraVars,
    };
}
function chooseTemplateKeys(pathname, vars) {
    if (pathname.startsWith('/read/')) {
        return {
            title: 'reader_title_template',
            keywords: 'reader_keywords_template',
            description: 'reader_description_template',
            fallbackTitle: defaults.reader_title_template,
            fallbackKeywords: defaults.reader_keywords_template,
            fallbackDescription: defaults.reader_description_template,
        };
    }
    if (pathname === '/book-detail' || pathname.startsWith('/book/')) {
        return {
            title: 'detail_title_template',
            keywords: 'detail_keywords_template',
            description: 'detail_description_template',
            fallbackTitle: defaults.detail_title_template,
            fallbackKeywords: defaults.detail_keywords_template,
            fallbackDescription: defaults.detail_description_template,
        };
    }
    if (pathname === '/ranking' || pathname.startsWith('/rank/')) {
        return {
            title: 'ranking_title_template',
            keywords: 'ranking_keywords_template',
            description: 'ranking_description_template',
            fallbackTitle: defaults.ranking_title_template,
            fallbackKeywords: defaults.ranking_keywords_template,
            fallbackDescription: defaults.ranking_description_template,
        };
    }
    if (vars.keyword) {
        return {
            title: 'search_title_template',
            keywords: 'search_keywords_template',
            description: 'search_description_template',
            fallbackTitle: defaults.search_title_template,
            fallbackKeywords: defaults.search_keywords_template,
            fallbackDescription: defaults.search_description_template,
        };
    }
    return {
        title: 'home_title',
        keywords: 'home_keywords',
        description: 'home_description',
        fallbackTitle: defaults.home_title,
        fallbackKeywords: defaults.home_keywords,
        fallbackDescription: defaults.home_description,
    };
}
function buildRouteSeo(requestUrl, configs, extraVars = {}) {
    const url = new URL(requestUrl, cleanDomain(configs));
    const vars = routeVars(url, extraVars);
    const keys = chooseTemplateKeys(url.pathname, vars);
    const title = renderSeoTemplate(configs[keys.title] || keys.fallbackTitle, configs, vars);
    const keywords = renderSeoTemplate(configs[keys.keywords] || keys.fallbackKeywords, configs, vars);
    const description = renderSeoTemplate(configs[keys.description] || keys.fallbackDescription, configs, vars);
    return {
        title: title || configs.site_title || '搜书网',
        keywords,
        description,
        canonical: `${cleanDomain(configs)}${url.pathname}`,
    };
}
function extractBookUrl(url) {
    if (url.pathname === '/book-detail') {
        return readQuery(url, 'bookUrl');
    }
    if (url.pathname.startsWith('/read/')) {
        const encoded = url.pathname.slice('/read/'.length);
        try {
            return decodeURIComponent(encoded);
        }
        catch {
            return encoded;
        }
    }
    return '';
}
async function loadBookSeoVars(requestUrl, configs) {
    const url = new URL(requestUrl, cleanDomain(configs));
    const bookUrl = extractBookUrl(url);
    if (!bookUrl)
        return {};
    const book = await (0, database_1.query)('SELECT name, author, intro, kind, latest_chapter_title, origin_name FROM books WHERE book_url=? LIMIT 1', [bookUrl]).then(rows => rows[0]).catch(() => null);
    if (!book)
        return {};
    return {
        bookName: book.name,
        author: book.author,
        intro: book.intro,
        category: book.kind,
        latestChapter: book.latest_chapter_title,
        sourceName: book.origin_name,
    };
}
function replaceOrInsertHead(html, pattern, value) {
    if (pattern.test(html))
        return html.replace(pattern, value);
    return html.replace(/<\/head>/i, `    ${value}\n  </head>`);
}
function injectSeoIntoHtml(html, configs, seo) {
    const configJson = escapeJsonForHtml((0, publicSiteConfig_1.filterPublicSiteConfigMap)(configs));
    let output = html
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);
    output = replaceOrInsertHead(output, /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${escapeHtml(seo.keywords)}" />`);
    output = replaceOrInsertHead(output, /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtml(seo.description)}" />`);
    output = replaceOrInsertHead(output, /<meta\s+name="web_domain"\s+content="[^"]*"\s*\/?>/i, `<meta name="web_domain" content="${escapeHtml(configs.web_domain || '')}" />`);
    output = replaceOrInsertHead(output, /<meta\s+name="wap_domain"\s+content="[^"]*"\s*\/?>/i, `<meta name="wap_domain" content="${escapeHtml(configs.wap_domain || '')}" />`);
    output = replaceOrInsertHead(output, /<meta\s+name="icp_number"\s+content="[^"]*"\s*\/?>/i, `<meta name="icp_number" content="${escapeHtml(configs.icp_number || '')}" />`);
    output = replaceOrInsertHead(output, /<meta\s+name="copyright"\s+content="[^"]*"\s*\/?>/i, `<meta name="copyright" content="${escapeHtml(configs.copyright || '')}" />`);
    output = replaceOrInsertHead(output, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`);
    output = replaceOrInsertHead(output, /<script\s+id="site-config-json"\s+type="application\/json">[\s\S]*?<\/script>/i, `<script id="site-config-json" type="application/json">${configJson}</script>`);
    return output;
}
async function renderFrontendHtml(indexPath, requestUrl) {
    const html = fs_1.default.readFileSync(indexPath, 'utf-8');
    const configs = await loadSiteConfigMap();
    const bookVars = await loadBookSeoVars(requestUrl, configs);
    return injectSeoIntoHtml(html, configs, buildRouteSeo(requestUrl, configs, bookVars));
}
async function syncStaticSeoShells(webDistPath) {
    const indexPath = path_1.default.join(webDistPath, 'index.html');
    if (!fs_1.default.existsSync(indexPath))
        return;
    const html = fs_1.default.readFileSync(indexPath, 'utf-8');
    const configs = await loadSiteConfigMap();
    const paths = ['/', '/ranking', '/book-detail', '/search', '/read'];
    for (const routePath of paths) {
        const output = injectSeoIntoHtml(html, configs, buildRouteSeo(routePath, configs));
        if (routePath === '/') {
            fs_1.default.writeFileSync(indexPath, output, 'utf-8');
        }
        else {
            fs_1.default.writeFileSync(path_1.default.join(webDistPath, routePath.replace(/^\//, '')), output, 'utf-8');
        }
    }
}
//# sourceMappingURL=seoHtmlService.js.map