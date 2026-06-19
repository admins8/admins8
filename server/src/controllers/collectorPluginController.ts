import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { execute, query, queryOne } from '../config/database';
import {
  deleteCollectorRule,
  exportCollectorRules,
  importCollectorRules,
  listCollectorRules,
  normalizeCollectorRule,
  runSingleBookCollector,
  saveCollectorRule,
  testCollectorRule,
} from '../services/collectorPlugin';
import {
  getBaiduPushPluginConfig,
  getBaiduPushPluginConfigForAdmin,
  listBaiduPushLogs,
  pushRecentSitemapUrls,
  pushUrlsToBaidu,
  saveBaiduPushPluginConfig,
  logBaiduPush,
} from '../services/baiduPushPlugin';

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => (
  req: Request,
  res: Response,
  next: any
) => fn(req, res).catch(next);

function parseRuleRow(row: any) {
  const rule = normalizeCollectorRule(JSON.parse(row.rule_json || '{}'));
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

export const listPlugins = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query('SELECT * FROM plugins ORDER BY id ASC');
  sendSuccess(res, rows.map(row => ({
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

export const updatePluginStatus = asyncHandler(async (req: Request, res: Response) => {
  const key = String(req.body.key || '').trim();
  if (!key) throw new Error('插件标识不能为空');
  await execute('UPDATE plugins SET enabled=?, updated_at=NOW() WHERE plugin_key=?', [req.body.enabled ? 1 : 0, key]);
  sendSuccess(res, await queryOne('SELECT * FROM plugins WHERE plugin_key=?', [key]));
});

export const getCollectorRules = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await listCollectorRules();
  sendSuccess(res, rows.map(parseRuleRow));
});

export const upsertCollectorRule = asyncHandler(async (req: Request, res: Response) => {
  const row = await saveCollectorRule(req.body);
  sendSuccess(res, parseRuleRow(row));
});

export const removeCollectorRule = asyncHandler(async (req: Request, res: Response) => {
  await deleteCollectorRule(Number(req.body.id));
  sendSuccess(res, { ok: true });
});

export const runCollectorRule = asyncHandler(async (req: Request, res: Response) => {
  const hasMaxChapters = Object.prototype.hasOwnProperty.call(req.body || {}, 'maxChapters');
  const result = await runSingleBookCollector(Number(req.body.id), {
    includeContent: !!req.body.includeContent,
    ...(hasMaxChapters ? { maxChapters: Number(req.body.maxChapters) } : {}),
    entryUrl: req.body.entryUrl,
  });
  sendSuccess(res, result);
});

export const testRule = asyncHandler(async (req: Request, res: Response) => {
  const result = await testCollectorRule(Number(req.body.id), {
    entryUrl: req.body.entryUrl,
  });
  sendSuccess(res, result);
});

export const importRules = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await importCollectorRules(req.body));
});

export const exportRules = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { rules: await exportCollectorRules(), exportedAt: new Date().toISOString() });
});

export const getCollectorLogs = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query('SELECT * FROM collector_logs ORDER BY id DESC LIMIT 100');
  sendSuccess(res, rows.map(row => ({
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

export const getBaiduPushConfig = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getBaiduPushPluginConfigForAdmin());
});

export const saveBaiduPushConfig = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await saveBaiduPushPluginConfig(req.body || {}));
});

export const pushBaiduUrls = asyncHandler(async (req: Request, res: Response) => {
  const config = await getBaiduPushPluginConfig();
  const urls = Array.isArray(req.body?.urls)
    ? req.body.urls.map((url: any) => String(url || '').trim()).filter(Boolean)
    : String(req.body?.urls || '').split(/\r?\n/).map(url => url.trim()).filter(Boolean);
  const result = await pushUrlsToBaidu(config, urls);
  await logBaiduPush(urls.length, result);
  sendSuccess(res, { ...result, urlCount: urls.length });
});

export const pushBaiduSitemap = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.body?.limit ? Number(req.body.limit) : undefined;
  sendSuccess(res, await pushRecentSitemapUrls(limit));
});

export const getBaiduPushLogs = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await listBaiduPushLogs());
});
