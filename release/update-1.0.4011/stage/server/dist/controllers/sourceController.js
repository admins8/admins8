"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSources = getSources;
exports.getSource = getSource;
exports.normalizeImportPayload = normalizeImportPayload;
exports.detectSourceCollectionUrlType = detectSourceCollectionUrlType;
exports.importSources = importSources;
exports.getValidationSchedule = getValidationSchedule;
exports.updateValidationSchedule = updateValidationSchedule;
exports.runValidationScheduleNow = runValidationScheduleNow;
exports.updateSource = updateSource;
exports.deleteSources = deleteSources;
exports.dedupeSources = dedupeSources;
exports.getSourceGroups = getSourceGroups;
exports.importFromUrl = importFromUrl;
exports.validateSource = validateSource;
exports.validateSourcesStream = validateSourcesStream;
const database_1 = require("../config/database");
const axios_1 = __importDefault(require("axios"));
const webBookService_1 = require("../services/webBookService");
const sourceValidator_1 = require("../services/sourceValidator");
const sourceValidationSchedule_1 = require("../services/sourceValidationSchedule");
const sourceDedupe_1 = require("../services/sourceDedupe");
const sourceUpdatePayload_1 = require("../services/sourceUpdatePayload");
const DEFAULT_VALIDATE_KEYWORD = '诡秘之主';
const DEFAULT_VALIDATE_TIMEOUT = 15000;
const DEFAULT_VALIDATE_CONCURRENCY = 5;
// 获取所有书源
async function getSources(req, res) {
    try {
        const { group, enabled, checkStatus } = req.query;
        let sql = 'SELECT id, book_source_url, book_source_name, book_source_group, book_source_type, enabled, enabled_explore, custom_order, weight, last_update_time, respond_time, search_url, rule_search, last_check_time, last_check_status, last_check_message FROM book_sources WHERE 1=1';
        const params = [];
        if (group) {
            sql += ' AND book_source_group LIKE ?';
            params.push(`%${group}%`);
        }
        if (enabled !== undefined) {
            sql += ' AND enabled = ?';
            params.push(enabled === '1' || enabled === 'true' ? 1 : 0);
        }
        if (checkStatus !== undefined && checkStatus !== '') {
            sql += ' AND last_check_status = ?';
            params.push(Number(checkStatus));
        }
        sql += ' ORDER BY custom_order ASC, book_source_name ASC';
        const sources = await (0, database_1.query)(sql, params);
        res.json({ code: 0, data: sources });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 获取单个书源
async function getSource(req, res) {
    try {
        const { id } = req.params;
        const source = await (0, database_1.queryOne)('SELECT * FROM book_sources WHERE id = ?', [id]);
        if (!source) {
            res.json({ code: 404, msg: '书源不存在' });
            return;
        }
        res.json({ code: 0, data: source });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
function normalizeImportPayload(payload) {
    let data = payload;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        }
        catch {
            throw new Error('书源导入内容不是有效 JSON');
        }
    }
    if (Array.isArray(data)) {
        return data;
    }
    if (data && typeof data === 'object') {
        return [data];
    }
    throw new Error('书源导入内容必须是对象、数组或 JSON 字符串');
}
function detectSourceCollectionUrlType(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        const path = parsed.pathname.toLowerCase();
        if (hostname === 'legado.aoaostar.com' && path.startsWith('/sources/')) {
            return 'unsupportedAdvancedLegadoCollection';
        }
        if (path.includes('/yuedu/shuyuan/'))
            return 'bookSource';
        if (path.includes('/yuedu/shuyuans/'))
            return 'bookSourceCollection';
        if (path.includes('/yuedu/rsss/'))
            return 'rssSourceCollection';
        return 'unknown';
    }
    catch {
        return 'unknown';
    }
}
async function importSourceList(sources) {
    const results = [];
    await (0, database_1.transaction)(async (conn) => {
        for (const s of sources) {
            try {
                const [result] = await conn.execute(`
            INSERT INTO book_sources (
              book_source_url, book_source_name, book_source_group, book_source_type,
              book_url_pattern, custom_order, enabled, enabled_explore,
              js_lib, enabled_cookie_jar, concurrent_rate, header,
              login_url, login_ui, login_check_js, cover_decode_js,
              book_source_comment, variable_comment, explore_url, search_url,
              rule_search, rule_book_info, rule_toc, rule_content, rule_review
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              book_source_name = VALUES(book_source_name),
              book_source_group = VALUES(book_source_group),
              book_source_type = VALUES(book_source_type),
              enabled = VALUES(enabled),
              enabled_explore = VALUES(enabled_explore),
              js_lib = VALUES(js_lib),
              search_url = VALUES(search_url),
              explore_url = VALUES(explore_url),
              header = VALUES(header),
              rule_search = VALUES(rule_search),
              rule_book_info = VALUES(rule_book_info),
              rule_toc = VALUES(rule_toc),
              rule_content = VALUES(rule_content),
              rule_review = VALUES(rule_review)
        `, [
                    s.bookSourceUrl, s.bookSourceName, s.bookSourceGroup || null,
                    s.bookSourceType || 0, s.bookUrlPattern || null, s.customOrder || 0,
                    s.enabled !== false ? 1 : 0, s.enabledExplore !== false ? 1 : 0,
                    s.jsLib || null, s.enabledCookieJar !== false ? 1 : 0,
                    s.concurrentRate || null, s.header || null,
                    s.loginUrl || null, s.loginUi || null, s.loginCheckJs || null,
                    s.coverDecodeJs || null, s.bookSourceComment || null,
                    s.variableComment || null, s.exploreUrl || null, s.searchUrl || null,
                    JSON.stringify(s.ruleSearch || {}), JSON.stringify(s.ruleBookInfo || {}),
                    JSON.stringify(s.ruleToc || {}), JSON.stringify(s.ruleContent || {}),
                    JSON.stringify(s.ruleReview || {})
                ]);
                results.push({ success: true, id: result.insertId, name: s.bookSourceName });
            }
            catch (e) {
                results.push({ success: false, name: s.bookSourceName, error: e.message });
            }
        }
    });
    return results;
}
async function importSources(req, res) {
    try {
        const sources = normalizeImportPayload(req.body);
        if (sources.length === 0) {
            res.status(400).json({ code: 400, msg: '没有可导入的书源' });
            return;
        }
        const results = await importSourceList(sources);
        const success = results.filter(r => r.success).length;
        const fail = results.length - success;
        res.json({
            code: 0,
            msg: `成功导入 ${success} 个书源${fail ? `，失败 ${fail} 个` : ''}`,
            data: { success, fail, results },
        });
    }
    catch (err) {
        res.status(400).json({ code: 400, msg: err.message });
    }
}
async function getValidationSchedule(req, res) {
    try {
        const settings = await (0, sourceValidationSchedule_1.getSourceValidationScheduleSettings)();
        res.json({ code: 0, data: settings });
    }
    catch (error) {
        console.error('获取书源定时验证配置失败:', error);
        res.status(500).json({ code: 500, message: error.message || '获取定时验证配置失败' });
    }
}
async function updateValidationSchedule(req, res) {
    try {
        const current = await (0, sourceValidationSchedule_1.getSourceValidationScheduleSettings)();
        const settings = await (0, sourceValidationSchedule_1.saveSourceValidationScheduleSettings)({ ...current, ...(req.body || {}) });
        await sourceValidationSchedule_1.sourceValidationScheduler.reload();
        res.json({ code: 0, data: settings, message: '定时验证配置已保存' });
    }
    catch (error) {
        console.error('保存书源定时验证配置失败:', error);
        res.status(500).json({ code: 500, message: error.message || '保存定时验证配置失败' });
    }
}
async function runValidationScheduleNow(req, res) {
    try {
        const settings = await (0, sourceValidationSchedule_1.getSourceValidationScheduleSettings)();
        const result = await (0, sourceValidationSchedule_1.runSourceValidationSchedule)(settings);
        const nextSettings = await (0, sourceValidationSchedule_1.saveSourceValidationScheduleSettings)({
            ...settings,
            lastRunAt: new Date().toISOString(),
            lastResult: result,
        });
        res.json({ code: 0, data: { result, settings: nextSettings }, message: '验证完成' });
    }
    catch (error) {
        console.error('立即执行书源定时验证失败:', error);
        res.status(500).json({ code: 500, message: error.message || '立即执行定时验证失败' });
    }
}
// 更新书源
async function updateSource(req, res) {
    try {
        const { id } = req.params;
        const data = req.body;
        const existing = await (0, database_1.queryOne)('SELECT id FROM book_sources WHERE id = ?', [id]);
        if (!existing) {
            res.json({ code: 404, msg: '书源不存在' });
            return;
        }
        await (0, database_1.execute)(`
      UPDATE book_sources SET
        book_source_name = COALESCE(?, book_source_name),
        book_source_group = COALESCE(?, book_source_group),
        book_source_type = COALESCE(?, book_source_type),
        enabled = COALESCE(?, enabled),
        enabled_explore = COALESCE(?, enabled_explore),
        custom_order = COALESCE(?, custom_order),
        search_url = COALESCE(?, search_url),
        explore_url = COALESCE(?, explore_url),
        header = COALESCE(?, header),
        js_lib = COALESCE(?, js_lib),
        book_source_comment = COALESCE(?, book_source_comment),
        rule_search = COALESCE(?, rule_search),
        rule_book_info = COALESCE(?, rule_book_info),
        rule_toc = COALESCE(?, rule_toc),
        rule_content = COALESCE(?, rule_content),
        updated_at = NOW()
      WHERE id = ?
    `, (0, sourceUpdatePayload_1.buildSourceUpdateParams)(data, String(id)));
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 删除书源
async function deleteSources(req, res) {
    try {
        const { ids } = req.body;
        const idList = Array.isArray(ids) ? ids : [ids];
        const placeholders = idList.map(() => '?').join(',');
        await (0, database_1.execute)(`DELETE FROM book_sources WHERE id IN (${placeholders})`, idList);
        res.json({ code: 0, msg: `已删除 ${idList.length} 个书源` });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function dedupeSources(req, res) {
    try {
        const rows = await (0, database_1.query)('SELECT id, book_source_url FROM book_sources ORDER BY id ASC');
        const duplicateIds = (0, sourceDedupe_1.findDuplicateSourceIds)(rows);
        if (duplicateIds.length > 0) {
            const placeholders = duplicateIds.map(() => '?').join(',');
            await (0, database_1.execute)(`DELETE FROM book_sources WHERE id IN (${placeholders})`, duplicateIds);
        }
        res.json({
            code: 0,
            data: { removed: duplicateIds.length, ids: duplicateIds },
            msg: duplicateIds.length > 0 ? `已去重 ${duplicateIds.length} 个书源` : '没有发现重复书源',
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message || '书源去重失败' });
    }
}
// 获取书源分组
async function getSourceGroups(req, res) {
    try {
        const groups = await (0, database_1.query)(`
      SELECT DISTINCT book_source_group FROM book_sources
      WHERE book_source_group IS NOT NULL AND book_source_group != ''
      ORDER BY book_source_group
    `);
        res.json({ code: 0, data: groups.map((row) => row.book_source_group) });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// SSRF 防护：禁止访问内网地址和危险协议
const BLOCKED_HOSTS = new Set([
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '169.254.169.254', // AWS 元数据
    'metadata.google.internal', // GCP 元数据
    'metadata', // 通用元数据
]);
const BLOCKED_PROTOCOLS = new Set(['file:', 'ftp:', 'gopher:', 'dict:', 'ldap:', 'tftp:']);
const PRIVATE_IP_PATTERNS = [
    /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^0\./, /^fc00:/i, /^fe80:/i,
];
function isBlockedUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
            return { blocked: true, reason: `禁止的协议: ${parsed.protocol}` };
        }
        const hostname = parsed.hostname.toLowerCase();
        if (BLOCKED_HOSTS.has(hostname)) {
            return { blocked: true, reason: `禁止的主机: ${hostname}` };
        }
        if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) {
            return { blocked: true, reason: `私有IP地址: ${hostname}` };
        }
        return { blocked: false };
    }
    catch {
        return { blocked: true, reason: '无效的URL' };
    }
}
// 从URL导入书源
async function importFromUrl(req, res) {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            res.json({ code: 400, msg: '缺少url参数' });
            return;
        }
        const collectionType = detectSourceCollectionUrlType(url);
        if (collectionType === 'rssSourceCollection') {
            res.json({
                code: 400,
                msg: '这是订阅源集合链接，不是书源链接。请在书源管理中导入单个书源或书源集合链接。',
            });
            return;
        }
        if (collectionType === 'unsupportedAdvancedLegadoCollection') {
            res.json({
                code: 400,
                msg: '暂不支持 legado.aoaostar.com 的高级 Legado 书源集合，请导入 YCK 书源、单个书源或普通书源 JSON。',
            });
            return;
        }
        const check = isBlockedUrl(url);
        if (check.blocked) {
            res.json({ code: 403, msg: `URL被阻止: ${check.reason}` });
            return;
        }
        const response = await axios_1.default.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            responseType: 'json',
        });
        let sources = [];
        if (Array.isArray(response.data)) {
            sources = response.data;
        }
        else if (response.data && Array.isArray(response.data.data)) {
            sources = response.data.data;
        }
        else if (response.data && typeof response.data === 'object') {
            const values = Object.values(response.data);
            if (values.length > 0 && Array.isArray(values[0])) {
                sources = values[0];
            }
            else {
                sources = [response.data];
            }
        }
        if (sources.length === 0) {
            res.json({ code: 400, msg: '未从URL解析到书源数据' });
            return;
        }
        const successList = [];
        const failList = [];
        // 逐条导入，失败不中断，不使用事务包裹全部（避免一条失败全部回滚）
        for (const s of sources) {
            try {
                await (0, database_1.execute)(`
          INSERT INTO book_sources (
            book_source_url, book_source_name, book_source_group, book_source_type,
            book_url_pattern, custom_order, enabled, enabled_explore,
            js_lib, enabled_cookie_jar, concurrent_rate, header,
            login_url, login_ui, login_check_js, cover_decode_js,
            book_source_comment, variable_comment, explore_url, search_url,
            rule_search, rule_book_info, rule_toc, rule_content, rule_review
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            book_source_name = VALUES(book_source_name),
            enabled = VALUES(enabled),
            search_url = VALUES(search_url),
            explore_url = VALUES(explore_url),
            rule_search = VALUES(rule_search),
            rule_book_info = VALUES(rule_book_info),
            rule_toc = VALUES(rule_toc),
            rule_content = VALUES(rule_content),
            rule_review = VALUES(rule_review)
        `, [
                    s.bookSourceUrl ?? s.book_source_url ?? null,
                    s.bookSourceName ?? s.book_source_name ?? '未命名书源',
                    s.bookSourceGroup ?? s.book_source_group ?? null,
                    s.bookSourceType ?? s.book_source_type ?? 0,
                    s.bookUrlPattern ?? s.book_url_pattern ?? null,
                    s.customOrder ?? s.custom_order ?? 0,
                    (s.enabled !== undefined ? s.enabled : true) !== false ? 1 : 0,
                    (s.enabledExplore !== undefined ? s.enabledExplore : true) !== false ? 1 : 0,
                    s.jsLib ?? s.js_lib ?? null,
                    (s.enabledCookieJar !== undefined ? s.enabledCookieJar : true) !== false ? 1 : 0,
                    s.concurrentRate ?? s.concurrent_rate ?? null,
                    s.header ?? null,
                    s.loginUrl ?? s.login_url ?? null,
                    s.loginUi ?? s.login_ui ?? null,
                    s.loginCheckJs ?? s.login_check_js ?? null,
                    s.coverDecodeJs ?? s.cover_decode_js ?? null,
                    s.bookSourceComment ?? s.book_source_comment ?? null,
                    s.variableComment ?? s.variable_comment ?? null,
                    s.exploreUrl ?? s.explore_url ?? null,
                    s.searchUrl ?? s.search_url ?? null,
                    JSON.stringify(s.ruleSearch ?? s.rule_search ?? {}),
                    JSON.stringify(s.ruleBookInfo ?? s.rule_book_info ?? {}),
                    JSON.stringify(s.ruleToc ?? s.rule_toc ?? {}),
                    JSON.stringify(s.ruleContent ?? s.rule_content ?? {}),
                    JSON.stringify(s.ruleReview ?? s.rule_review ?? {})
                ]);
                successList.push(s.bookSourceName ?? s.book_source_name ?? '未命名书源');
            }
            catch (e) {
                failList.push({
                    name: s.bookSourceName ?? s.book_source_name ?? '未命名书源',
                    error: e.message,
                });
            }
        }
        res.json({
            code: 0,
            msg: `导入完成：成功 ${successList.length} 个，失败 ${failList.length} 个`,
            data: { success: successList.length, fail: failList.length, failedNames: failList.map((f) => f.name) },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message || '从URL导入书源失败' });
    }
}
// =================== 书源验证 ===================
/** 验证单条书源（支持多关键词，任意一个成功即视为有效） */
async function validateOne(source, keywords, timeoutMs) {
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
            // 只要有一个关键词搜到结果，就视为有效
            if (results && results.length > 0) {
                return (0, sourceValidator_1.interpretValidationResult)({
                    results,
                    respondTime: Date.now() - start,
                });
            }
            // 当前关键词无结果，记录并尝试下一个
            errors.push(`"${kw}" 无结果`);
        }
        catch (err) {
            errors.push(`"${kw}" ${err.message || '失败'}`);
        }
    }
    // 所有关键词都失败
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
/** 单条验证（同步返回） */
async function validateSource(req, res) {
    try {
        const id = Number(req.body?.id || req.params?.id);
        const rawKeyword = String(req.body?.keyword || DEFAULT_VALIDATE_KEYWORD).trim() || DEFAULT_VALIDATE_KEYWORD;
        const keywords = rawKeyword.split(/[,，]+/).map((k) => k.trim()).filter(Boolean);
        const timeout = Number(req.body?.timeout) || DEFAULT_VALIDATE_TIMEOUT;
        if (!id) {
            res.json({ code: 400, msg: 'id 必填' });
            return;
        }
        const source = await (0, database_1.queryOne)('SELECT * FROM book_sources WHERE id = ?', [id]);
        if (!source) {
            res.json({ code: 404, msg: '书源不存在' });
            return;
        }
        const outcome = await validateOne(source, keywords, timeout);
        await persistValidationResult(id, outcome);
        res.json({ code: 0, data: { id, ...outcome } });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message || '验证失败' });
    }
}
/** 批量验证（流式 SSE） */
async function validateSourcesStream(req, res) {
    // 兼容 GET（query.ids）和 POST；认证只从 Header/Cookie 获取，不再接受 query token
    const method = req.method.toUpperCase();
    const source = method === 'GET' ? req.query : req.body;
    const rawKeyword = String(source.keyword || DEFAULT_VALIDATE_KEYWORD).trim() || DEFAULT_VALIDATE_KEYWORD;
    const keywords = rawKeyword.split(/[,，]+/).map((k) => k.trim()).filter(Boolean);
    const timeoutMs = Number(source.timeout) || DEFAULT_VALIDATE_TIMEOUT;
    const concurrency = Math.max(1, Math.min(10, Number(source.concurrency) || DEFAULT_VALIDATE_CONCURRENCY));
    // ids 可以是数组、JSON 字符串、逗号分隔字符串
    let ids = [];
    const rawIds = source.ids;
    if (Array.isArray(rawIds)) {
        ids = rawIds.map(Number).filter((n) => Number.isFinite(n));
    }
    else if (typeof rawIds === 'string' && rawIds.trim()) {
        try {
            const parsed = JSON.parse(rawIds);
            if (Array.isArray(parsed)) {
                ids = parsed.map(Number).filter((n) => Number.isFinite(n));
            }
        }
        catch {
            ids = rawIds.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
        }
    }
    // 如果未传 ids，则验证所有启用书源
    let sources = [];
    if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        sources = await (0, database_1.query)(`SELECT * FROM book_sources WHERE id IN (${placeholders})`, ids);
    }
    else {
        sources = await (0, database_1.query)('SELECT * FROM book_sources WHERE enabled = 1');
    }
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    const total = sources.length;
    let done = 0;
    let okCount = 0;
    let failCount = 0;
    let aborted = false;
    req.on('close', () => { aborted = true; });
    const sendEvent = (event, data) => {
        if (aborted)
            return;
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    sendEvent('start', { total, keyword: rawKeyword, keywords });
    // 简易并发池
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, sources.length) }, async () => {
        while (!aborted) {
            const idx = cursor++;
            if (idx >= sources.length)
                return;
            const src = sources[idx];
            const outcome = await validateOne(src, keywords, timeoutMs);
            try {
                await persistValidationResult(src.id, outcome);
            }
            catch {
                // 写库失败不影响流
            }
            done++;
            if (outcome.ok)
                okCount++;
            else
                failCount++;
            sendEvent('progress', {
                id: src.id,
                name: src.book_source_name,
                ok: outcome.ok,
                message: outcome.message,
                respondTime: outcome.respondTime,
                sampleCount: outcome.sampleCount,
                done,
                total,
                okCount,
                failCount,
            });
        }
    });
    try {
        await Promise.all(workers);
        sendEvent('done', { total, okCount, failCount });
    }
    catch (err) {
        sendEvent('error', { message: err?.message || '验证过程出错' });
    }
    finally {
        if (!aborted)
            res.end();
    }
}
//# sourceMappingURL=sourceController.js.map