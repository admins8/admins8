"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBaiduPushConfig = normalizeBaiduPushConfig;
exports.buildBaiduPushEndpoint = buildBaiduPushEndpoint;
exports.pushUrlsToBaidu = pushUrlsToBaidu;
exports.getBaiduPushPluginConfig = getBaiduPushPluginConfig;
exports.getBaiduPushPluginConfigForAdmin = getBaiduPushPluginConfigForAdmin;
exports.saveBaiduPushPluginConfig = saveBaiduPushPluginConfig;
exports.logBaiduPush = logBaiduPush;
exports.pushRecentSitemapUrls = pushRecentSitemapUrls;
exports.listBaiduPushLogs = listBaiduPushLogs;
const database_1 = require("../config/database");
const seoService_1 = require("./seoService");
const PLUGIN_KEY = 'baidu_push';
function cleanSite(site) {
    return String(site || '').trim().replace(/\/+$/, '');
}
function maskToken(token) {
    const value = String(token || '');
    if (!value)
        return '';
    if (value.length <= 4)
        return `${value.slice(0, 1)}***`;
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
function normalizeBaiduPushConfig(input = {}) {
    const dailyLimit = Number(input.dailyLimit ?? 100);
    const token = String(input.token || '').trim();
    const config = {
        site: cleanSite(input.site || 'https://soumal.com'),
        token,
        enabled: input.enabled !== false,
        dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? Math.floor(dailyLimit) : 100,
        maskedToken: maskToken(token),
    };
    return config;
}
function buildBaiduPushEndpoint(site, token) {
    return `https://data.zz.baidu.com/urls?site=${encodeURIComponent(cleanSite(site))}&token=${encodeURIComponent(String(token || '').trim())}`;
}
async function pushUrlsToBaidu(config, urls, fetcher = fetch) {
    const normalized = normalizeBaiduPushConfig(config);
    if (!normalized.enabled)
        return { ok: false, status: 0, success: 0, remain: null, error: '百度主动推送插件未启用', raw: null };
    if (!normalized.site || !normalized.token)
        return { ok: false, status: 0, success: 0, remain: null, error: '请先配置站点地址和百度推送 token', raw: null };
    const uniqueUrls = Array.from(new Set(urls.map(url => String(url || '').trim()).filter(Boolean))).slice(0, normalized.dailyLimit);
    if (!uniqueUrls.length)
        return { ok: false, status: 0, success: 0, remain: null, error: '没有可推送的 URL', raw: null };
    const response = await fetcher(buildBaiduPushEndpoint(normalized.site, normalized.token), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: uniqueUrls.join('\n'),
    });
    const text = await response.text();
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch {
        raw = { raw: text };
    }
    const success = Number(raw.success || 0);
    const remain = raw.remain === undefined ? null : Number(raw.remain);
    const error = raw.error ? `${raw.error}${raw.message ? `: ${raw.message}` : ''}` : '';
    return { ok: response.ok && !error, status: response.status, success, remain, error, raw };
}
async function getBaiduPushPluginConfig() {
    const row = await (0, database_1.queryOne)('SELECT config_json, enabled FROM plugins WHERE plugin_key=? LIMIT 1', [PLUGIN_KEY]);
    const config = normalizeBaiduPushConfig(row?.config_json ? JSON.parse(row.config_json) : {});
    config.enabled = !!row?.enabled;
    return config;
}
async function getBaiduPushPluginConfigForAdmin() {
    const config = await getBaiduPushPluginConfig();
    return { ...config, token: '' };
}
async function saveBaiduPushPluginConfig(config) {
    const current = await getBaiduPushPluginConfig().catch(() => normalizeBaiduPushConfig());
    const merged = { ...current, ...config };
    if (!Object.prototype.hasOwnProperty.call(config, 'token') || String(config.token || '').trim() === '') {
        merged.token = current.token;
    }
    const normalized = normalizeBaiduPushConfig(merged);
    await (0, database_1.execute)(`INSERT INTO plugins (plugin_key, name, description, enabled, config_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), config_json=VALUES(config_json), updated_at=NOW()`, [PLUGIN_KEY, '百度主动推送', '将 sitemap、新书和更新链接主动提交到百度搜索资源平台', normalized.enabled ? 1 : 0, JSON.stringify({ site: normalized.site, token: normalized.token, dailyLimit: normalized.dailyLimit })]);
    return normalized;
}
async function logBaiduPush(urlCount, result) {
    await (0, database_1.execute)('INSERT INTO baidu_push_logs (url_count, success_count, remain_count, status, message, raw_json) VALUES (?, ?, ?, ?, ?, ?)', [urlCount, result.success, result.remain, result.ok ? 'success' : 'failed', result.error || 'ok', JSON.stringify(result.raw || {})]).catch(() => undefined);
}
async function pushRecentSitemapUrls(limit) {
    const config = await getBaiduPushPluginConfig();
    const urls = await (0, seoService_1.collectSitemapUrls)(config.site, limit || config.dailyLimit);
    const result = await pushUrlsToBaidu(config, urls.map(item => item.loc));
    await logBaiduPush(urls.length, result);
    return { ...result, urlCount: urls.length };
}
async function listBaiduPushLogs(limit = 100) {
    return (0, database_1.query)(`SELECT id, url_count AS urlCount, success_count AS successCount, remain_count AS remainCount,
            status, message, raw_json AS rawJson, created_at AS createdAt
       FROM baidu_push_logs ORDER BY id DESC LIMIT ?`, [Math.max(1, Math.min(200, limit))]).catch(() => []);
}
//# sourceMappingURL=baiduPushPlugin.js.map