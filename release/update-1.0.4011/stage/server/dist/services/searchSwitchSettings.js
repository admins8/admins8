"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEARCH_SWITCH_DEFAULTS = void 0;
exports.normalizeSearchSwitchSettings = normalizeSearchSwitchSettings;
exports.getSearchSwitchSettings = getSearchSwitchSettings;
const siteConfigRepository_1 = require("../repositories/siteConfigRepository");
exports.SEARCH_SWITCH_DEFAULTS = {
    searchVerifyToc: false,
    searchSourceConcurrency: 50,
    searchSourceTimeoutMs: 5000,
    searchTocTimeoutMs: 3000,
    sourceSwitchConcurrency: 50,
    sourceSwitchTimeoutMs: 5000,
    sourceSwitchTocTimeoutMs: 3000,
    alternateSourceCacheTtlSeconds: 3600,
    searchRequestUserAgents: '',
    searchRequestProxy: '',
};
function toBool(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}
function toInt(value, fallback, min, max) {
    const n = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(min, Math.min(max, n));
}
function normalizeSearchSwitchSettings(configMap) {
    return {
        searchVerifyToc: toBool(configMap.search_verify_toc, exports.SEARCH_SWITCH_DEFAULTS.searchVerifyToc),
        searchSourceConcurrency: toInt(configMap.search_source_concurrency, exports.SEARCH_SWITCH_DEFAULTS.searchSourceConcurrency, 1, 50),
        searchSourceTimeoutMs: toInt(configMap.search_source_timeout_ms, exports.SEARCH_SWITCH_DEFAULTS.searchSourceTimeoutMs, 1000, 30000),
        searchTocTimeoutMs: toInt(configMap.search_toc_timeout_ms, exports.SEARCH_SWITCH_DEFAULTS.searchTocTimeoutMs, 1000, 30000),
        sourceSwitchConcurrency: toInt(configMap.source_switch_concurrency, exports.SEARCH_SWITCH_DEFAULTS.sourceSwitchConcurrency, 1, 80),
        sourceSwitchTimeoutMs: toInt(configMap.source_switch_timeout_ms, exports.SEARCH_SWITCH_DEFAULTS.sourceSwitchTimeoutMs, 1000, 30000),
        sourceSwitchTocTimeoutMs: toInt(configMap.source_switch_toc_timeout_ms, exports.SEARCH_SWITCH_DEFAULTS.sourceSwitchTocTimeoutMs, 1000, 30000),
        alternateSourceCacheTtlSeconds: toInt(configMap.alternate_source_cache_ttl_seconds, exports.SEARCH_SWITCH_DEFAULTS.alternateSourceCacheTtlSeconds, 0, 86400),
        searchRequestUserAgents: String(configMap.search_request_user_agents ?? exports.SEARCH_SWITCH_DEFAULTS.searchRequestUserAgents).trim(),
        searchRequestProxy: String(configMap.search_request_proxy ?? exports.SEARCH_SWITCH_DEFAULTS.searchRequestProxy).trim(),
    };
}
async function getSearchSwitchSettings() {
    const configs = await (0, siteConfigRepository_1.getAllSiteConfigs)();
    const map = {};
    for (const item of configs) {
        map[item.config_key] = item.config_value;
    }
    return normalizeSearchSwitchSettings(map);
}
//# sourceMappingURL=searchSwitchSettings.js.map