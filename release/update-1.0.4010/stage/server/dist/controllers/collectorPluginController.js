"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaiduPushLogs = exports.pushBaiduSitemap = exports.pushBaiduUrls = exports.saveBaiduPushConfig = exports.getBaiduPushConfig = exports.getCollectorLogs = exports.exportRules = exports.importRules = exports.testRule = exports.runCollectorRule = exports.removeCollectorRule = exports.upsertCollectorRule = exports.getCollectorRules = exports.updatePluginStatus = exports.listPlugins = void 0;
const apiResponse_1 = require("../utils/apiResponse");
const database_1 = require("../config/database");
const collectorPlugin_1 = require("../services/collectorPlugin");
const baiduPushPlugin_1 = require("../services/baiduPushPlugin");
const asyncHandler = (fn) => (req, res, next) => fn(req, res).catch(next);
function parseRuleRow(row) {
    const rule = (0, collectorPlugin_1.normalizeCollectorRule)(JSON.parse(row.rule_json || '{}'));
    return {
        id: row.id,
        name: row.name,
        entryUrl: row.entry_url,
        enabled: !!row.enabled,
        rule,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
exports.listPlugins = asyncHandler(async (_req, res) => {
    const rows = await (0, database_1.query)('SELECT * FROM plugins ORDER BY id ASC');
    (0, apiResponse_1.sendSuccess)(res, rows.map(row => ({
        id: row.id,
        key: row.plugin_key,
        name: row.name,
        description: row.description,
        enabled: !!row.enabled,
        config: row.config_json ? JSON.parse(row.config_json) : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })));
});
exports.updatePluginStatus = asyncHandler(async (req, res) => {
    const key = String(req.body.key || '').trim();
    if (!key)
        throw new Error('插件标识不能为空');
    await (0, database_1.execute)('UPDATE plugins SET enabled=?, updated_at=NOW() WHERE plugin_key=?', [req.body.enabled ? 1 : 0, key]);
    (0, apiResponse_1.sendSuccess)(res, await (0, database_1.queryOne)('SELECT * FROM plugins WHERE plugin_key=?', [key]));
});
exports.getCollectorRules = asyncHandler(async (_req, res) => {
    const rows = await (0, collectorPlugin_1.listCollectorRules)();
    (0, apiResponse_1.sendSuccess)(res, rows.map(parseRuleRow));
});
exports.upsertCollectorRule = asyncHandler(async (req, res) => {
    const row = await (0, collectorPlugin_1.saveCollectorRule)(req.body);
    (0, apiResponse_1.sendSuccess)(res, parseRuleRow(row));
});
exports.removeCollectorRule = asyncHandler(async (req, res) => {
    await (0, collectorPlugin_1.deleteCollectorRule)(Number(req.body.id));
    (0, apiResponse_1.sendSuccess)(res, { ok: true });
});
exports.runCollectorRule = asyncHandler(async (req, res) => {
    const hasMaxChapters = Object.prototype.hasOwnProperty.call(req.body || {}, 'maxChapters');
    const result = await (0, collectorPlugin_1.runSingleBookCollector)(Number(req.body.id), {
        includeContent: !!req.body.includeContent,
        ...(hasMaxChapters ? { maxChapters: Number(req.body.maxChapters) } : {}),
        entryUrl: req.body.entryUrl,
    });
    (0, apiResponse_1.sendSuccess)(res, result);
});
exports.testRule = asyncHandler(async (req, res) => {
    const result = await (0, collectorPlugin_1.testCollectorRule)(Number(req.body.id), {
        entryUrl: req.body.entryUrl,
    });
    (0, apiResponse_1.sendSuccess)(res, result);
});
exports.importRules = asyncHandler(async (req, res) => {
    (0, apiResponse_1.sendSuccess)(res, await (0, collectorPlugin_1.importCollectorRules)(req.body));
});
exports.exportRules = asyncHandler(async (_req, res) => {
    (0, apiResponse_1.sendSuccess)(res, { rules: await (0, collectorPlugin_1.exportCollectorRules)(), exportedAt: new Date().toISOString() });
});
exports.getCollectorLogs = asyncHandler(async (_req, res) => {
    const rows = await (0, database_1.query)('SELECT * FROM collector_logs ORDER BY id DESC LIMIT 100');
    (0, apiResponse_1.sendSuccess)(res, rows.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        status: row.status,
        message: row.message,
        bookName: row.book_name,
        chapterCount: row.chapter_count,
        contentCount: row.content_count,
        createdAt: row.created_at,
    })));
});
exports.getBaiduPushConfig = asyncHandler(async (_req, res) => {
    (0, apiResponse_1.sendSuccess)(res, await (0, baiduPushPlugin_1.getBaiduPushPluginConfig)());
});
exports.saveBaiduPushConfig = asyncHandler(async (req, res) => {
    (0, apiResponse_1.sendSuccess)(res, await (0, baiduPushPlugin_1.saveBaiduPushPluginConfig)(req.body || {}));
});
exports.pushBaiduUrls = asyncHandler(async (req, res) => {
    const config = await (0, baiduPushPlugin_1.getBaiduPushPluginConfig)();
    const urls = Array.isArray(req.body?.urls)
        ? req.body.urls.map((url) => String(url || '').trim()).filter(Boolean)
        : String(req.body?.urls || '').split(/\r?\n/).map(url => url.trim()).filter(Boolean);
    const result = await (0, baiduPushPlugin_1.pushUrlsToBaidu)(config, urls);
    await (0, baiduPushPlugin_1.logBaiduPush)(urls.length, result);
    (0, apiResponse_1.sendSuccess)(res, { ...result, urlCount: urls.length });
});
exports.pushBaiduSitemap = asyncHandler(async (req, res) => {
    const limit = req.body?.limit ? Number(req.body.limit) : undefined;
    (0, apiResponse_1.sendSuccess)(res, await (0, baiduPushPlugin_1.pushRecentSitemapUrls)(limit));
});
exports.getBaiduPushLogs = asyncHandler(async (_req, res) => {
    (0, apiResponse_1.sendSuccess)(res, await (0, baiduPushPlugin_1.listBaiduPushLogs)());
});
//# sourceMappingURL=collectorPluginController.js.map