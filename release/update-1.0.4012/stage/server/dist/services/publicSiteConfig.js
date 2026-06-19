"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_SITE_CONFIG_KEYS = void 0;
exports.isPublicSiteConfigKey = isPublicSiteConfigKey;
exports.filterPublicSiteConfigs = filterPublicSiteConfigs;
exports.filterPublicSiteConfigMap = filterPublicSiteConfigMap;
exports.PUBLIC_SITE_CONFIG_KEYS = new Set([
    'site_title',
    'site_subtitle',
    'site_logo',
    'web_domain',
    'wap_domain',
    'icp_number',
    'analytics_code',
    'copyright',
    'home_title',
    'home_keywords',
    'home_description',
    'detail_title_template',
    'detail_keywords_template',
    'detail_description_template',
    'reader_title_template',
    'reader_keywords_template',
    'reader_description_template',
    'search_title_template',
    'search_keywords_template',
    'search_description_template',
    'ranking_title_template',
    'ranking_keywords_template',
    'ranking_description_template',
    'default_book_cover',
    'guest_search_enabled',
    'guest_read_chapter_limit',
    'friendly_links_enabled',
]);
const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|private|credential|smtp_|pop3_|imap_|email_|jwt|license|key)$/i;
function isPublicSiteConfigKey(key) {
    const normalized = String(key || '').trim();
    return exports.PUBLIC_SITE_CONFIG_KEYS.has(normalized) && !SENSITIVE_KEY_PATTERN.test(normalized);
}
function filterPublicSiteConfigs(items) {
    return items.filter(item => isPublicSiteConfigKey(item.config_key));
}
function filterPublicSiteConfigMap(map) {
    return Object.fromEntries(Object.entries(map).filter(([key]) => isPublicSiteConfigKey(key)));
}
//# sourceMappingURL=publicSiteConfig.js.map