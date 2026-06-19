import { query, queryOne, execute } from '../config/database';
import { webBookEngine } from './webBookService';
import { interpretValidationResult } from './sourceValidator';

export const DEFAULT_SOURCE_VALIDATE_KEYWORD = '诡秘之主';
export const DEFAULT_SOURCE_VALIDATE_TIMEOUT = 15000;
export const DEFAULT_SOURCE_VALIDATE_CONCURRENCY = 5;

export type SourceValidationFailureAction = 'none' | 'disable' | 'delete';
export type SourceValidationScope = 'enabled' | 'all' | 'failed';

export interface SourceValidationScheduleSettings {
  enabled: boolean;
  day: number;
  hour: number;
  minute: number;
  keyword: string;
  timeoutMs: number;
  concurrency: number;
  scope: SourceValidationScope;
  failureAction: SourceValidationFailureAction;
  lastRunKey: string;
  lastRunAt: string;
  lastResult: {
    total: number;
    okCount: number;
    failCount: number;
    disabledCount: number;
    deletedCount: number;
    message: string;
  };
}

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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function parseLastResult(value: unknown): SourceValidationScheduleSettings['lastResult'] {
  const fallback = { total: 0, okCount: 0, failCount: 0, disabledCount: 0, deletedCount: 0, message: '' };
  if (!value) return fallback;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return { ...fallback, ...(parsed || {}) };
  } catch {
    return fallback;
  }
}

export function normalizeSourceValidationSchedule(input: Record<string, unknown>): SourceValidationScheduleSettings {
  const failureAction = String(input.source_validate_schedule_failure_action || 'none');
  const scope = String(input.source_validate_schedule_scope || 'enabled');
  return {
    enabled: parseBoolean(input.source_validate_schedule_enabled),
    day: clampNumber(input.source_validate_schedule_day, 1, 28, 1),
    hour: clampNumber(input.source_validate_schedule_hour, 0, 23, 3),
    minute: clampNumber(input.source_validate_schedule_minute, 0, 59, 0),
    keyword: String(input.source_validate_schedule_keyword || DEFAULT_SOURCE_VALIDATE_KEYWORD).trim() || DEFAULT_SOURCE_VALIDATE_KEYWORD,
    timeoutMs: clampNumber(input.source_validate_schedule_timeout_ms, 3000, 60000, DEFAULT_SOURCE_VALIDATE_TIMEOUT),
    concurrency: clampNumber(input.source_validate_schedule_concurrency, 1, 10, DEFAULT_SOURCE_VALIDATE_CONCURRENCY),
    scope: ['enabled', 'all', 'failed'].includes(scope) ? scope as SourceValidationScope : 'enabled',
    failureAction: ['none', 'disable', 'delete'].includes(failureAction) ? failureAction as SourceValidationFailureAction : 'none',
    lastRunKey: String(input.source_validate_last_run_key || ''),
    lastRunAt: String(input.source_validate_last_run_at || ''),
    lastResult: parseLastResult(input.source_validate_last_result),
  };
}

export function buildSourceValidationRunKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

export function shouldRunSourceValidationSchedule(
  settings: SourceValidationScheduleSettings,
  now: Date,
  lastRunKey: string,
  running: boolean
): boolean {
  if (!settings.enabled || running) return false;
  if (now.getDate() !== settings.day) return false;
  if (now.getHours() !== settings.hour) return false;
  if (now.getMinutes() !== settings.minute) return false;
  return buildSourceValidationRunKey(now) !== lastRunKey;
}

export async function validateOneSource(source: any, keywords: string[], timeoutMs: number) {
  const start = Date.now();
  const errors: string[] = [];
  for (const kw of keywords) {
    try {
      const results = await Promise.race([
        webBookEngine.search(source, kw),
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error(`timeout of ${timeoutMs}ms exceeded`)), timeoutMs);
        }),
      ]) as any[];
      if (results && results.length > 0) {
        return interpretValidationResult({ results, respondTime: Date.now() - start });
      }
      errors.push(`"${kw}" 无结果`);
    } catch (err: any) {
      errors.push(`"${kw}" ${err.message || '失败'}`);
    }
  }
  return interpretValidationResult({
    error: new Error(errors.join('；')),
    respondTime: Date.now() - start,
  });
}

export async function persistValidationResult(id: number, outcome: ReturnType<typeof interpretValidationResult>) {
  await execute(
    `UPDATE book_sources
        SET last_check_time = NOW(),
            last_check_status = ?,
            last_check_message = ?,
            respond_time = ?
      WHERE id = ?`,
    [outcome.ok ? 1 : 2, outcome.message, outcome.respondTime, id]
  );
}

async function upsertConfig(key: string, value: string, description = ''): Promise<void> {
  await execute(
    `INSERT INTO site_config (config_key, config_value, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()`,
    [key, value, description]
  );
}

export async function getSourceValidationScheduleSettings(): Promise<SourceValidationScheduleSettings> {
  const rows = await query(
    `SELECT config_key, config_value FROM site_config WHERE config_key IN (${CONFIG_KEYS.map(() => '?').join(',')})`,
    CONFIG_KEYS
  ) as any[];
  const raw: Record<string, unknown> = {};
  for (const row of rows) raw[row.config_key] = row.config_value;
  return normalizeSourceValidationSchedule(raw);
}

export async function saveSourceValidationScheduleSettings(input: Partial<SourceValidationScheduleSettings>): Promise<SourceValidationScheduleSettings> {
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

async function loadScheduledSources(scope: SourceValidationScope): Promise<any[]> {
  if (scope === 'all') return query('SELECT * FROM book_sources') as Promise<any[]>;
  if (scope === 'failed') return query('SELECT * FROM book_sources WHERE last_check_status = 2') as Promise<any[]>;
  return query('SELECT * FROM book_sources WHERE enabled = 1') as Promise<any[]>;
}

async function applyFailureAction(id: number, action: SourceValidationFailureAction): Promise<'none' | 'disabled' | 'deleted'> {
  if (action === 'disable') {
    await execute('UPDATE book_sources SET enabled = 0, updated_at = NOW() WHERE id = ?', [id]);
    return 'disabled';
  }
  if (action === 'delete') {
    await execute('DELETE FROM book_sources WHERE id = ?', [id]);
    return 'deleted';
  }
  return 'none';
}

export async function runSourceValidationSchedule(settings?: SourceValidationScheduleSettings) {
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
      } else {
        failCount++;
        const action = await applyFailureAction(source.id, cfg.failureAction);
        if (action === 'disabled') disabledCount++;
        if (action === 'deleted') deletedCount++;
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
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.tick(), 60 * 1000);
    void this.tick();
    console.log('[书源定时验证] 调度器已启动');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async reload(): Promise<void> {
    this.start();
  }

  private async tick(): Promise<void> {
    const settings = await getSourceValidationScheduleSettings();
    const now = new Date();
    if (!shouldRunSourceValidationSchedule(settings, now, settings.lastRunKey, this.running)) return;
    const runKey = buildSourceValidationRunKey(now);
    this.running = true;
    await upsertConfig('source_validate_last_run_key', runKey);
    await upsertConfig('source_validate_last_run_at', now.toISOString());
    try {
      const result = await runSourceValidationSchedule(settings);
      await upsertConfig('source_validate_last_result', JSON.stringify(result));
      console.log(`[书源定时验证] ${result.message}`);
    } catch (err: any) {
      await upsertConfig('source_validate_last_result', JSON.stringify({
        total: 0,
        okCount: 0,
        failCount: 0,
        disabledCount: 0,
        deletedCount: 0,
        message: err.message || '定时验证失败',
      }));
      console.error('[书源定时验证] 执行失败:', err.message);
    } finally {
      this.running = false;
    }
  }
}

export const sourceValidationScheduler = new SourceValidationScheduler();
