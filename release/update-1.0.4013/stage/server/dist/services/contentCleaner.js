"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultContentCleanerRules = void 0;
exports.normalizeContentCleanerRules = normalizeContentCleanerRules;
exports.cleanContent = cleanContent;
exports.defaultContentCleanerRules = {
    removeTags: ['script', 'style', 'iframe'],
    removeTexts: [],
    removePatterns: [
        '第\\s*\\d+\\s*/\\s*\\d+\\s*页',
        '请收藏本站.*?$',
        '^\\s*.{0,12}提示您[:：].*?(?:收藏|域名|网址|www\\.|https?://).*?$',
        '^\\s*.{0,20}(?:看后|喜欢|方便下次).*?(?:收藏|书签).*?(?:www\\.|https?://|域名|网址|更方便).*?$',
        '^\\s*请(?:记住|牢记|收藏).*?(?:域名|网址|地址|发布页|首发|书签|www\\.|https?://).*?$',
        '最新网址.*?$',
        '^\\s*(?:最新|备用|永久|首发|官方)?(?:网址|地址|域名|发布页)[:：].*?$',
        '^\\s*(?:手机用户|安卓用户|苹果用户|读者).*?(?:APP|app|客户端|公众号|微信|搜索|下载).*?$',
        '^\\s*更多内容加载中.*?$',
        '^\\s*(?:本站|本网站|该站点).{0,20}(?:只支持|仅支持).*?(?:手机浏览器|浏览器访问|阅读模式|广告屏蔽|复制网址).*?$',
        '^\\s*若您看到此段落.*?(?:加载失败|阅读模式|广告屏蔽|复制网址).*?$',
        '^\\s*.*?(?:章节内容加载失败|关闭浏览器的阅读模式|关闭广告屏蔽功能|复制网址到其他浏览器阅读).*?$',
        '本章未完.*?$',
        '^\\s*Please\\s+(?:visit|bookmark|remember)\\b.*?(?:www\\.|https?://|latest\\s+chapter|chapter|site|website).*?$',
        '^\\s*If\\s+you\\s+find\\s+any\\s+errors\\b.*?$',
        '^\\s*(?:This\\s+chapter\\s+is\\s+updated|Read\\s+the\\s+latest\\s+chapter|Download\\s+.*?app)\\b.*?$',
        '^\\s*(?:www\\.|https?://)[^\\s\\u4e00-\\u9fa5]+\\s*$',
        "^\\s*window\\.[A-Za-z_$][\\w$]*\\s*=\\s*['\"][A-Za-z0-9+/=\\s]{40,}['\"];?\\s*$",
    ],
    replacements: [],
};
function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function decodeHtmlEntities(input) {
    return String(input || '')
        .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_match, code) => {
        const value = Number(code);
        return Number.isFinite(value) ? String.fromCharCode(value) : '';
    })
        .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
        const value = parseInt(code, 16);
        return Number.isFinite(value) ? String.fromCharCode(value) : '';
    });
}
function normalizeContentCleanerRules(input) {
    if (!input)
        return { ...exports.defaultContentCleanerRules };
    try {
        const raw = typeof input === 'string' ? JSON.parse(input) : input;
        return {
            removeTags: Array.isArray(raw.removeTags) ? raw.removeTags.map(String).filter(Boolean) : exports.defaultContentCleanerRules.removeTags,
            removeTexts: Array.isArray(raw.removeTexts) ? raw.removeTexts.map(String).filter(Boolean) : [],
            removePatterns: Array.isArray(raw.removePatterns) ? raw.removePatterns.map(String).filter(Boolean) : exports.defaultContentCleanerRules.removePatterns,
            replacements: Array.isArray(raw.replacements)
                ? raw.replacements
                    .filter((item) => item && item.pattern)
                    .map((item) => ({
                    pattern: String(item.pattern),
                    replacement: String(item.replacement ?? ''),
                    flags: String(item.flags || 'g'),
                }))
                : [],
        };
    }
    catch {
        return { ...exports.defaultContentCleanerRules };
    }
}
function cleanContent(content, customRules) {
    let text = String(content || '');
    const rules = normalizeContentCleanerRules(customRules);
    for (const tag of rules.removeTags || []) {
        const safeTag = escapeRegExp(tag);
        text = text.replace(new RegExp(`<${safeTag}\\b[^>]*>[\\s\\S]*?<\\/${safeTag}>`, 'gi'), '');
        text = text.replace(new RegExp(`<\\/?${safeTag}\\b[^>]*>`, 'gi'), '');
    }
    text = text
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\/\s*p\s*>/gi, '\n')
        .replace(/<\s*p\b[^>]*>/gi, '\n')
        .replace(/<\/\s*div\s*>/gi, '\n')
        .replace(/<\s*div\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '');
    text = decodeHtmlEntities(text);
    for (const item of rules.replacements || []) {
        try {
            text = text.replace(new RegExp(item.pattern, item.flags || 'g'), item.replacement || '');
        }
        catch {
            // 忽略非法正则，避免影响阅读
        }
    }
    for (const item of rules.removeTexts || []) {
        text = text.replace(new RegExp(escapeRegExp(item), 'g'), '');
    }
    for (const pattern of rules.removePatterns || []) {
        try {
            text = text.replace(new RegExp(pattern, 'gmi'), '');
        }
        catch {
            // 忽略非法正则，避免影响阅读
        }
    }
    return text
        .split('\n')
        .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
//# sourceMappingURL=contentCleaner.js.map