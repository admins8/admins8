"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceValidationScheduler = exports.DEFAULT_SOURCE_VALIDATE_CONCURRENCY = exports.DEFAULT_SOURCE_VALIDATE_TIMEOUT = exports.DEFAULT_SOURCE_VALIDATE_KEYWORD = void 0;
exports.normalizeSourceValidationSchedule = normalizeSourceValidationSchedule;
exports.buildSourceValidationRunKey = buildSourceValidationRunKey;
exports.shouldRunSourceValidationSchedule = shouldRunSourceValidationSchedule;
exports.validateOneSource = validateOneSource;
exports.persistValidationResult = persistValidationResult;
exports.getSourceValidationScheduleSettings = getSourceValidationScheduleSettings;
exports.saveSourceValidationScheduleSettings = saveSourceValidationScheduleSettings;
exports.runSourceValidationSchedule = runSourceValidationSchedule;
const database_1 = require("../config/database");
const webBookService_1 = require("./webBookService");
const sourceValidator_1 = require("./sourceValidator");
exports.DEFAULT_SOURCE_VALIDATE_KEYWORD = '诡秘之主';
exports.DEFAULT_SOURCE_VALIDATE_TIMEOUT = 15000;
exports.DEFAULT_SOURCE_VALIDATE_CONCURRENCY = 5;
const CONFIG_KEYS = [
    'source_validate_schedule_enabled',
    'source_validate_schedule_day',
    'source_validate_schedule_hour',
    'source_validate_schedule_minute',
    'source_validate_schedule_keyword',
    'source_validate_schedule_timeout_ms',
    'source_validate_schedule_concurrency',
    'source_validate_schedule_scope',
    'source_validate_schedule_failure_action',
    'source_validate_last_run_key',
    'source_validate_last_run_at',
    'source_validate_last_result',
];
function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(num)));
}
function parseBoolean(value) {
    return value === true || value === 'true' || value === '1' || value === 1;
}
function parseLastResult(value) {
    const fallback = { total: 0, okCount: 0, failCount: 0, disabledCount: 0, deletedCount: 0, message: '' };
    if (!value)
        return fallback;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return { ...fallback, ...(parsed || {}) };
    }
    catch {
        return fallback;
    }
}
function normalizeSourceValidationSchedule(input) {
    const failureAction = String(input.source_validate_schedule_failure_action || 'none');
    const scope = String(input.source_validate_schedule_scope || 'enabled');
    return {
        enabled: parseBoolean(input.source_validate_schedule_enabled),
        day: clampNumber(input.source_validate_schedule_day, 1, 28, 1),
        hour: clampNumber(input.source_validate_schedule_hour, 0, 23, 3),
        minute: clampNumber(input.source_validate_schedule_minute, 0, 59, 0),
        keyword: String(input.source_validate_schedule_keyword || exports.DEFAULT_SOURCE_VALIDATE_KEYWORD).trim() || exports.DEFAULT_SOURCE_VALIDATE_KEYWORD,
        timeoutMs: clampNumber(input.source_validate_schedule_timeout_ms, 3000, 60000, exports.DEFAULT_SOURCE_VALIDATE_TIMEOUT),
        concurrency: clampNumber(input.source_validate_schedule_concurrency, 1, 10, exports.DEFAULT_SOURCE_VALIDATE_CONCURRENCY),
        scope: ['enabled', 'all', 'failed'].includes(scope) ? scope : 'enabled',
        failureAction: ['none', 'disable', 'delete'].includes(failureAction) ? failureAction : 'none',
        lastRunKey: String(input.source_validate_last_run_key || ''),
        lastRunAt: String(input.source_validate_last_run_at || ''),
        lastResult: parseLastResult(input.source_validate_last_result),
    };
}
function buildSourceValidationRunKey(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
function shouldRunSourceValidationSchedule(settings, now, lastRunKey, running) {
    if (!settings.enabled || running)
        return false;
    if (now.getDate() !== settings.day)
        return false;
    if (now.getHours() !== settings.hour)
        return false;
    if (now.getMinutes() !== settings.minute)
        return false;
    return buildSourceValidationRunKey(now) !== lastRunKey;
}
async function validateOneSource(source, keywords, timeoutMs) {
    const start = Date.now();
    const errors = [];
    for (const kw of keywords) {
        try {
            const results = await Promise.race([
                webBookService_1.webBookEngine.search(source, kw),
                new Promise((_resolve, reject) => {
                    setTimeout(() => reject(new Error(`timeout of ${timeoutMs}ms exceeded`)), timeoutMs);
                }),
            ]);
            if (results && results.length > 0) {
                return (0, sourceValidator_1.interpretValidationResult)({ results, respondTime: Date.now() - start });
            }
            errors.push(`"${kw}" 无结果`);
        }
        catch (err) {
            errors.push(`"${kw}" ${err.message || '失败'}`);
        }
    }
    return (0, sourceValidator_1.interpretValidationResult)({
        error: new Error(errors.join('；')),
        respondTime: Date.now() - start,
    });
}
async function persistValidationResult(id, outcome) {
    await (0, database_1.execute)(`UPDATE book_sources
        SET last_check_time = NOW(),
            last_check_status = ?,
            last_check_message = ?,
            respond_time = ?
      WHERE id = ?`, [outcome.ok ? 1 : 2, outcome.message, outcome.respondTime, id]);
}
async function upsertConfig(key, value, description = '') {
    await (0, database_1.execute)(`INSERT INTO site_config (config_key, config_value, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()`, [key, value, description]);
}
async function getSourceValidationScheduleSettings() {
    const rows = await (0, database_1.query)(`SELECT config_key, config_value FROM site_config WHERE config_key IN (${CONFIG_KEYS.map(() => '?').join(',')})`, CONFIG_KEYS);
    const raw = {};
    for (const row of rows)
        raw[row.config_key] = row.config_value;
    return normalizeSourceValidationSchedule(raw);
}
async function saveSourceValidationScheduleSettings(input) {
    const merged = normalizeSourceValidationSchedule({
        source_validate_schedule_enabled: input.enabled,
        source_validate_schedule_day: input.day,
        source_validate_schedule_hour: input.hour,
        source_validate_schedule_minute: input.minute,
        source_validate_schedule_keyword: input.keyword,
        source_validate_schedule_timeout_ms: input.timeoutMs,
        source_validate_schedule_concurrency: input.concurrency,
        source_validate_schedule_scope: input.scope,
        source_validate_schedule_failure_action: input.failureAction,
        source_validate_last_run_key: input.lastRunKey,
        source_validate_last_run_at: input.lastRunAt,
        source_validate_last_result: JSON.stringify(input.lastResult || {}),
    });
    await upsertConfig('source_validate_schedule_enabled', String(merged.enabled), '是否启用书源定时验证');
    await upsertConfig('source_validate_schedule_day', String(merged.day), '书源定时验证每月几号执行');
    await upsertConfig('source_validate_schedule_hour', String(merged.hour), '书源定时验证小时');
    await upsertConfig('source_validate_schedule_minute', String(merged.minute), '书源定时验证分钟');
    await upsertConfig('source_validate_schedule_keyword', merged.keyword, '书源定时验证关键词');
    await upsertConfig('source_validate_schedule_timeout_ms', String(merged.timeoutMs), '书源定时验证单源超时毫秒');
    await upsertConfig('source_validate_schedule_concurrency', String(merged.concurrency), '书源定时验证并发数');
    await upsertConfig('source_validate_schedule_scope', merged.scope, '书源定时验证范围');
    await upsertConfig('source_validate_schedule_failure_action', merged.failureAction, '书源验证失败后的处理动作');
    await upsertConfig('source_validate_last_run_key', merged.lastRunKey, '书源定时验证最近执行键');
    await upsertConfig('source_validate_last_run_at', merged.lastRunAt, '书源定时验证最近执行时间');
    await upsertConfig('source_validate_last_result', JSON.stringify(merged.lastResult), '书源定时验证最近执行结果');
    return getSourceValidationScheduleSettings();
}
async function loadScheduledSources(scope) {
    if (scope === 'all')
        return (0, database_1.query)('SELECT * FROM book_sources');
    if (scope === 'failed')
        return (0, database_1.query)('SELECT * FROM book_sources WHERE last_check_status = 2');
    return (0, database_1.query)('SELECT * FROM book_sources WHERE enabled = 1');
}
async function applyFailureAction(id, action) {
    if (action === 'disable') {
        await (0, database_1.execute)('UPDATE book_sources SET enabled = 0, updated_at = NOW() WHERE id = ?', [id]);
        return 'disabled';
    }
    if (action === 'delete') {
        await (0, database_1.execute)('DELETE FROM book_sources WHERE id = ?', [id]);
        return 'deleted';
    }
    return 'none';
}
async function runSourceValidationSchedule(settings) {
    const cfg = settings || await getSourceValidationScheduleSettings();
    const keywords = cfg.keyword.split(/[,，\n]+/).map(item => item.trim()).filter(Boolean);
    const sources = await loadScheduledSources(cfg.scope);
    let cursor = 0;
    let okCount = 0;
    let failCount = 0;
    let disabledCount = 0;
    let deletedCount = 0;
    const workers = Array.from({ length: Math.min(cfg.concurrency, sources.length) }, async () => {
        while (cursor < sources.length) {
            const source = sources[cursor++];
            const outcome = await validateOneSource(source, keywords, cfg.timeoutMs);
            await persistValidationResult(source.id, outcome);
            if (outcome.ok) {
                okCount++;
            }
            else {
                failCount++;
                const action = await applyFailureAction(source.id, cfg.failureAction);
                if (action === 'disabled')
                    disabledCount++;
                if (action === 'deleted')
                    deletedCount++;
            }
        }
    });
    await Promise.all(workers);
    return {
        total: sources.length,
        okCount,
        failCount,
        disabledCount,
        deletedCount,
        message: `验证完成：有效 ${okCount}，失效 ${failCount}`,
    };
}
class SourceValidationScheduler {
    timer = null;
    running = false;
    start() {
        this.stop();
        this.timer = setInterval(() => this.tick(), 60 * 1000);
        void this.tick();
        console.log('[书源定时验证] 调度器已启动');
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    async reload() {
        this.start();
    }
    async tick() {
        const settings = await getSourceValidationScheduleSettings();
        const now = new Date();
        if (!shouldRunSourceValidationSchedule(settings, now, settings.lastRunKey, this.running))
            return;
        const runKey = buildSourceValidationRunKey(now);
        this.running = true;
        await upsertConfig('source_validate_last_run_key', runKey);
        await upsertConfig('source_validate_last_run_at', now.toISOString());
        try {
            const result = await runSourceValidationSchedule(settings);
            await upsertConfig('source_validate_last_result', JSON.stringify(result));
            console.log(`[书源定时验证] ${result.message}`);
        }
        catch (err) {
            await upsertConfig('source_validate_last_result', JSON.stringify({
                total: 0,
                okCount: 0,
                failCount: 0,
                disabledCount: 0,
                deletedCount: 0,
                message: err.message || '定时验证失败',
            }));
            console.error('[书源定时验证] 执行失败:', err.message);
        }
        finally {
            this.running = false;
        }
    }
}
exports.sourceValidationScheduler = new SourceValidationScheduler();
//# sourceMappingURL=sourceValidationSchedule.js.map