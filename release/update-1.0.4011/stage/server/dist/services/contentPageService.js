"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATIC_PAGE_DEFAULTS = void 0;
exports.normalizeContentPagePayload = normalizeContentPagePayload;
exports.listContentPages = listContentPages;
exports.getAdminContentPage = getAdminContentPage;
exports.getPublicContentPage = getPublicContentPage;
exports.updateContentPage = updateContentPage;
const database_1 = require("../config/database");
exports.STATIC_PAGE_DEFAULTS = [
    { slug: 'about', title: '关于我们', content: '<p>请在后台编辑关于我们页面内容。</p>' },
    { slug: 'contact', title: '联系我们', content: '<p>请在后台编辑联系方式。</p>' },
    { slug: 'agreement', title: '用户协议', content: '<p>请在后台编辑用户协议。</p>' },
    { slug: 'privacy', title: '隐私政策', content: '<p>请在后台编辑隐私政策。</p>' },
];
function boolToTinyInt(value) {
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}
function normalizeContentPagePayload(payload) {
    return {
        title: String(payload?.title || '').trim(),
        content: String(payload?.content || ''),
        is_active: boolToTinyInt(payload?.is_active ?? 1),
        seo_title: String(payload?.seo_title || '').trim(),
        seo_keywords: String(payload?.seo_keywords || '').trim(),
        seo_description: String(payload?.seo_description || '').trim(),
    };
}
async function listContentPages() {
    return (0, database_1.query)('SELECT * FROM content_pages ORDER BY sort_order ASC, id ASC');
}
async function getAdminContentPage(slug) {
    return (0, database_1.queryOne)('SELECT * FROM content_pages WHERE slug = ? LIMIT 1', [slug]);
}
async function getPublicContentPage(slug) {
    return (0, database_1.queryOne)('SELECT * FROM content_pages WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
}
async function updateContentPage(slug, payload) {
    const data = normalizeContentPagePayload(payload);
    if (!data.title)
        throw new Error('页面标题不能为空');
    await (0, database_1.execute)(`UPDATE content_pages
     SET title = ?, content = ?, is_active = ?, seo_title = ?, seo_keywords = ?, seo_description = ?, updated_at = NOW()
     WHERE slug = ?`, [data.title, data.content, data.is_active, data.seo_title, data.seo_keywords, data.seo_description, slug]);
    return getAdminContentPage(slug);
}
//# sourceMappingURL=contentPageService.js.map