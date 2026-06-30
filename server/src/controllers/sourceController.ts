import { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../config/database';
import axios from 'axios';
import {
  getSourceValidationScheduleSettings,
  saveSourceValidationScheduleSettings,
  runSourceValidationSchedule,
  validateOneSource,
  persistValidationResult,
} from '../services/sourceValidationSchedule';

function toInt(value: unknown, fallback = 0): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBool(value: unknown, fallback = true): boolean {
  if (value === '' || value === null || value === undefined) return fallback;
  return value !== false && value !== 0 && value !== '0' && value !== 'false';
}

function toStr(value: unknown, fallback: string | null = null): string | null {
  if (value === '' || value === null || value === undefined) return fallback;
  return String(value);
}

// 获取所有书源
export async function getSources(req: Request, res: Response): Promise<void> {
  try {
    const { group, enabled } = req.query;
    let sql = 'SELECT id, book_source_url, book_source_name, book_source_group, book_source_type, enabled, enabled_explore, custom_order, weight, last_update_time, respond_time, search_url, rule_search FROM book_sources WHERE 1=1';
    const params: any[] = [];

    if (group) {
      sql += ' AND book_source_group LIKE ?';
      params.push(`%${group}%`);
    }
    if (enabled !== undefined) {
      sql += ' AND enabled = ?';
      params.push(enabled === '1' || enabled === 'true' ? 1 : 0);
    }
    sql += ' ORDER BY custom_order ASC, book_source_name ASC';

    const sources = await query(sql, params);
    res.json({ code: 0, data: sources });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 书源登录 ==========

import { executeSourceLogin, checkSourceLoginStatus, parseLoginUi } from '../services/sourceLoginService';

/**
 * 获取书源的登录 UI 配置
 * GET /api/sources/:id/login-ui
 */
export async function getSourceLoginUi(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const source = await queryOne('SELECT * FROM book_sources WHERE id = ?', [id]);
    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }
    const loginUi = parseLoginUi(source.login_ui || source.loginUi);
    const loginUrl = source.login_url || source.loginUrl;
    res.json({ code: 0, data: { loginUi, hasLogin: !!loginUrl } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/**
 * 执行书源登录
 * POST /api/sources/:id/login
 */
export async function loginSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const formData = req.body;

    const source = await queryOne('SELECT * FROM book_sources WHERE id = ?', [id]);
    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }

    const result = await executeSourceLogin(source, formData);
    if (result.success) {
      res.json({ code: 0, msg: result.message });
    } else {
      res.json({ code: 500, msg: result.message });
    }
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/**
 * 检查书源登录状态
 * GET /api/sources/:id/login-status
 */
export async function checkSourceLoginStatusApi(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const source = await queryOne('SELECT * FROM book_sources WHERE id = ?', [id]);
    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }
    const loggedIn = await checkSourceLoginStatus(source);
    res.json({ code: 0, data: { loggedIn } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 书源去重 ==========

export async function dedupeSources(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(
      `SELECT book_source_url, book_source_name, COUNT(*) as cnt FROM book_sources GROUP BY book_source_url, book_source_name HAVING cnt > 1`
    ) as any[];

    let removed = 0;
    const ids: number[] = [];
    for (const row of rows) {
      const dupes = await query(
        `SELECT id FROM book_sources WHERE book_source_url = ? AND book_source_name = ? ORDER BY id ASC`,
        [row.book_source_url, row.book_source_name]
      ) as any[];
      for (let i = 1; i < dupes.length; i++) {
        ids.push(dupes[i].id);
        await execute('DELETE FROM book_sources WHERE id = ?', [dupes[i].id]);
        removed++;
      }
    }

    res.json({ code: 0, data: { removed, ids } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 单条验证书源 ==========

export async function validateSource(req: Request, res: Response): Promise<void> {
  try {
    const { id, keyword } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }

    const source = await queryOne(
      'SELECT * FROM book_sources WHERE id = ?',
      [id]
    ) as any;

    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }

    const startTime = Date.now();
    let ok = false;
    let message = '';

    try {
      // 尝试用搜索URL验证书源可用性
      const searchUrl = source.search_url || '';
      if (searchUrl && keyword) {
        // 简单验证：尝试访问书源URL看是否可达
        const sourceUrl = source.book_source_url;
        const testUrl = sourceUrl.replace(/\/$/, '');
        const response = await axios.get(testUrl, {
          timeout: (source.respond_time || 15000),
          responseType: 'text',
          validateStatus: () => true,
        });
        ok = response.status >= 200 && response.status < 400;
        message = ok ? '连接正常' : `HTTP ${response.status}`;
      } else {
        // 没有搜索URL，直接测试源URL可达性
        const sourceUrl = source.book_source_url;
        const response = await axios.get(sourceUrl, {
          timeout: (source.respond_time || 15000),
          responseType: 'text',
          validateStatus: () => true,
        });
        ok = response.status >= 200 && response.status < 400;
        message = ok ? '连接正常' : `HTTP ${response.status}`;
      }
    } catch (e: any) {
      ok = false;
      message = e.code === 'ECONNABORTED' ? '连接超时' : (e.message || '连接失败');
    }

    const respondTime = Date.now() - startTime;

    // 更新书源验证状态（同时更新 last_check_time / last_check_status / last_check_message）
    await execute(
      `UPDATE book_sources
          SET last_update_time = ?,
              last_check_time = NOW(),
              last_check_status = ?,
              last_check_message = ?,
              respond_time = ?,
              weight = ?
        WHERE id = ?`,
      [Date.now(), ok ? 1 : 2, message, respondTime, ok ? source.weight : 0, id]
    );

    res.json({ code: 0, data: { ok, message, respondTime } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取单个书源
export async function getSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const source = await queryOne('SELECT * FROM book_sources WHERE id = ?', [id]);
    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }
    res.json({ code: 0, data: source });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 添加书源
export async function addSource(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    const sources = Array.isArray(data) ? data : [data];
    const results: any[] = [];

    await transaction(async (conn) => {
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
            toStr(s.bookSourceUrl), toStr(s.bookSourceName, '未命名书源'), toStr(s.bookSourceGroup),
            toInt(s.bookSourceType, 0), toStr(s.bookUrlPattern), toInt(s.customOrder, 0),
            toBool(s.enabled, true) ? 1 : 0, toBool(s.enabledExplore, true) ? 1 : 0,
            toStr(s.jsLib), toBool(s.enabledCookieJar, true) ? 1 : 0,
            toStr(s.concurrentRate), toStr(s.header),
            toStr(s.loginUrl), toStr(s.loginUi), toStr(s.loginCheckJs),
            toStr(s.coverDecodeJs), toStr(s.bookSourceComment),
            toStr(s.variableComment), toStr(s.exploreUrl), toStr(s.searchUrl),
            JSON.stringify(s.ruleSearch || {}), JSON.stringify(s.ruleBookInfo || {}),
            JSON.stringify(s.ruleToc || {}), JSON.stringify(s.ruleContent || {}),
            JSON.stringify(s.ruleReview || {})
          ]);
          results.push({ success: true, id: (result as any).insertId });
        } catch (e: any) {
          results.push({ success: false, name: s.bookSourceName, error: e.message });
        }
      }
    });

    res.json({ code: 0, msg: `成功导入 ${results.filter(r => r.success).length} 个书源`, data: results });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 更新书源
export async function updateSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await queryOne('SELECT id FROM book_sources WHERE id = ?', [id]);
    if (!existing) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }

    // 将 undefined 转为 null，避免 MySQL2 绑定参数报错
    const val = (v: unknown) => (v === undefined ? null : v);

    await execute(`
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
    `, [
      val(data.bookSourceName), val(data.bookSourceGroup), val(data.bookSourceType),
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : null,
      data.enabledExplore !== undefined ? (data.enabledExplore ? 1 : 0) : null,
      val(data.customOrder), val(data.searchUrl), val(data.exploreUrl),
      val(data.header), val(data.jsLib), val(data.bookSourceComment),
      data.ruleSearch ? JSON.stringify(data.ruleSearch) : null,
      data.ruleBookInfo ? JSON.stringify(data.ruleBookInfo) : null,
      data.ruleToc ? JSON.stringify(data.ruleToc) : null,
      data.ruleContent ? JSON.stringify(data.ruleContent) : null,
      id
    ]);

    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 删除书源
export async function deleteSources(req: Request, res: Response): Promise<void> {
  try {
    const { ids } = req.body;
    const idList = Array.isArray(ids) ? ids : [ids];
    const placeholders = idList.map(() => '?').join(',');
    await execute(`DELETE FROM book_sources WHERE id IN (${placeholders})`, idList);
    res.json({ code: 0, msg: `已删除 ${idList.length} 个书源` });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取书源分组
export async function getSourceGroups(req: Request, res: Response): Promise<void> {
  try {
    const groups = await query(`
      SELECT DISTINCT book_source_group FROM book_sources
      WHERE book_source_group IS NOT NULL AND book_source_group != ''
      ORDER BY book_source_group
    `);
    res.json({ code: 0, data: groups.map((row: any) => row.book_source_group) });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 从URL导入书源
export async function importFromUrl(req: Request, res: Response): Promise<void> {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.json({ code: 400, msg: '缺少url参数' });
      return;
    }

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      responseType: 'json',
    });

    let sources: any[] = [];
    if (Array.isArray(response.data)) {
      sources = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      sources = response.data.data;
    } else if (response.data && typeof response.data === 'object') {
      const values = Object.values(response.data);
      if (values.length > 0 && Array.isArray(values[0])) {
        sources = values[0] as any[];
      } else {
        sources = [response.data];
      }
    }

    if (sources.length === 0) {
      res.json({ code: 400, msg: '未从URL解析到书源数据' });
      return;
    }

    const successList: string[] = [];
    const failList: { name: string; error: string }[] = [];

    await transaction(async (conn) => {
      for (const s of sources) {
        try {
          await conn.execute(`
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
            toStr(s.bookSourceUrl ?? s.book_source_url),
            toStr(s.bookSourceName ?? s.book_source_name, '未命名书源'),
            toStr(s.bookSourceGroup ?? s.book_source_group),
            toInt(s.bookSourceType ?? s.book_source_type, 0),
            toStr(s.bookUrlPattern ?? s.book_url_pattern),
            toInt(s.customOrder ?? s.custom_order, 0),
            toBool(s.enabled, true) ? 1 : 0,
            toBool(s.enabledExplore, true) ? 1 : 0,
            toStr(s.jsLib ?? s.js_lib),
            toBool(s.enabledCookieJar, true) ? 1 : 0,
            toStr(s.concurrentRate ?? s.concurrent_rate),
            toStr(s.header),
            toStr(s.loginUrl ?? s.login_url),
            toStr(s.loginUi ?? s.login_ui),
            toStr(s.loginCheckJs ?? s.login_check_js),
            toStr(s.coverDecodeJs ?? s.cover_decode_js),
            toStr(s.bookSourceComment ?? s.book_source_comment),
            toStr(s.variableComment ?? s.variable_comment),
            toStr(s.exploreUrl ?? s.explore_url),
            toStr(s.searchUrl ?? s.search_url),
            JSON.stringify(s.ruleSearch ?? s.rule_search ?? {}),
            JSON.stringify(s.ruleBookInfo ?? s.rule_book_info ?? {}),
            JSON.stringify(s.ruleToc ?? s.rule_toc ?? {}),
            JSON.stringify(s.ruleContent ?? s.rule_content ?? {}),
            JSON.stringify(s.ruleReview ?? s.rule_review ?? {})
          ]);
          successList.push(s.bookSourceName ?? s.book_source_name ?? '未命名书源');
        } catch (e: any) {
          failList.push({
            name: s.bookSourceName ?? s.book_source_name ?? '未命名书源',
            error: e.message,
          });
        }
      }
    });

    res.json({
      code: 0,
      msg: `导入完成：成功 ${successList.length} 个，失败 ${failList.length} 个`,
      data: { success: successList.length, fail: failList.length, failedNames: failList.map((f) => f.name) },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message || '从URL导入书源失败' });
  }
}

// ========== 定时验证 ==========

export async function getValidationSchedule(req: Request, res: Response): Promise<void> {
  try {
    const settings = await getSourceValidationScheduleSettings();
    res.json({ code: 0, data: settings });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function updateValidationSchedule(req: Request, res: Response): Promise<void> {
  try {
    const settings = await saveSourceValidationScheduleSettings(req.body);
    res.json({ code: 0, data: settings });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function runValidationScheduleNow(req: Request, res: Response): Promise<void> {
  try {
    const result = await runSourceValidationSchedule();
    const settings = await getSourceValidationScheduleSettings();
    res.json({ code: 0, data: { result, settings } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/**
 * SSE 流式批量验证书源
 * 前端通过 EventSource 连接 /api/sources/validate-stream
 * 事件: start -> progress(多个) -> done
 */
export async function validateStream(req: Request, res: Response): Promise<void> {
  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx 代理时禁用缓冲

  // 解析参数（从 POST body 读取，避免 URL 长度超限）
  const body = req.body || {};
  const keyword = String(body.keyword || '诡秘之主');
  const keywords = keyword.split(/[,，]+/).map(k => k.trim()).filter(Boolean);
  const timeoutMs = Math.max(3000, Math.min(60000, parseInt(String(body.timeout || '15000'), 10) || 15000));
  const concurrency = Math.max(1, Math.min(10, parseInt(String(body.concurrency || '3'), 10) || 3));

  let ids: number[] = [];
  try {
    ids = Array.isArray(body.ids) ? body.ids : [];
  } catch {
    ids = [];
  }

  if (ids.length === 0) {
    res.write('event: error\ndata: {"message":"没有可验证的书源"}\n\n');
    res.end();
    return;
  }

  // 发送 SSE 事件辅助函数
  function sendEvent(event: string, data: any) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // 从数据库获取书源 — 使用动态占位符确保 IN 子句正确展开
  const placeholders = ids.map(() => '?').join(',');
  const sources = await query(
    `SELECT * FROM book_sources WHERE id IN (${placeholders})`,
    ids
  ) as any[];

  sendEvent('start', { total: sources.length });

  // 心跳定时器：每 25 秒发送一次 ping，防止 nginx/浏览器超时断开
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  // 并发控制队列
  let idx = 0;
  async function next(): Promise<void> {
    while (idx < sources.length) {
      const i = idx++;
      const source = sources[i];
      try {
        const outcome = await validateOneSource(source, keywords, timeoutMs);
        // 持久化验证结果
        await persistValidationResult(source.id, outcome);
        sendEvent('progress', {
          id: source.id,
          name: source.book_source_name,
          ok: outcome.ok,
          sampleCount: outcome.sampleCount,
          respondTime: outcome.respondTime,
          message: outcome.message,
        });
      } catch (err: any) {
        try {
          sendEvent('progress', {
            id: source.id,
            name: source.book_source_name,
            ok: false,
            sampleCount: 0,
            respondTime: 0,
            message: err.message || '验证异常',
          });
        } catch {
          // 客户端可能已断开，忽略写入错误
        }
      }
    }
  }

  try {
    // 启动并发 worker
    const workers = Array.from({ length: Math.min(concurrency, sources.length) }, () => next());
    await Promise.all(workers);

    sendEvent('done', { total: sources.length });
  } finally {
    clearInterval(heartbeatTimer);
    res.end();
  }
}

// ========== 发现/目录站功能 ==========

import { exploreBook, exploreBookMulti, parseExploreUrl } from '../services/exploreService';

/**
 * 获取书源的发现入口列表
 * GET /api/sources/:id/explore-kinds
 */
export async function getExploreKinds(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const source = await queryOne('SELECT * FROM book_sources WHERE id = ?', [id]);
    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }
    const exploreUrl = source.explore_url || source.exploreUrl;
    if (!exploreUrl) {
      res.json({ code: 0, data: [] });
      return;
    }
    const kinds = parseExploreUrl(exploreUrl);
    res.json({ code: 0, data: kinds });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/**
 * 获取书源的发现结果
 * GET /api/sources/:id/explore?url=...
 */
export async function exploreSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const exploreUrl = req.query.url as string | undefined;

    const source = await queryOne('SELECT * FROM book_sources WHERE id = ?', [id]);
    if (!source) {
      res.json({ code: 404, msg: '书源不存在' });
      return;
    }

    const books = await exploreBook(source, exploreUrl);
    res.json({ code: 0, data: books });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/**
 * 获取所有启用发现功能的书源列表
 * GET /api/sources/explore-enabled
 */
export async function getExploreEnabledSources(req: Request, res: Response): Promise<void> {
  try {
    const sources = await query(
      `SELECT id, book_source_name, book_source_url, explore_url, enabled_explore
       FROM book_sources
       WHERE enabled = 1 AND enabled_explore = 1 AND explore_url IS NOT NULL AND explore_url != ''
       ORDER BY weight DESC, custom_order ASC`
    );
    res.json({ code: 0, data: sources });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}
