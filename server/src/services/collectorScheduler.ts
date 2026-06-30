import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { query, execute } from '../config/database';
import { runBatchCollector } from './collectorPlugin';
import { normalizeCollectorRule } from './collectorPlugin';

interface ScheduleRow {
  id: number;
  rule_id: number;
  cron: string;
  max_books: number;
  max_pages: number;
  enabled: number;
  last_run_at: string | null;
}

interface RuleRow {
  id: number;
  name: string;
  entry_url: string;
  entry_urls: string | null;
  rule_json: string | null;
  enabled: number;
}

// 存储活跃的 cron 任务
const activeJobs = new Map<number, ScheduledTask>();
// 存储当前任务的 cron 表达式，用于检测变更
const activeCronExpressions = new Map<number, string>();

// 标记是否已初始化
let initialized = false;

/**
 * 验证 cron 表达式是否有效
 */
export function isValidCron(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * 立即刷新调度任务（供 save/delete 调用后立即生效）
 */
export async function refreshSchedulesNow(): Promise<void> {
  await refreshSchedules();
}

/**
 * 启动所有已启用的定时采集任务
 */
export async function startCollectorScheduler(): Promise<void> {
  try {
    console.log('[Scheduler] 正在加载定时采集任务...');

    const schedules = await query(
      'SELECT * FROM collector_schedules WHERE enabled = 1'
    ) as ScheduleRow[];

    let loadedCount = 0;
    for (const schedule of schedules) {
      if (schedule.enabled && schedule.cron) {
        if (scheduleCronJob(schedule)) {
          loadedCount++;
        }
      }
    }

    console.log(`[Scheduler] 已加载 ${loadedCount} 个定时采集任务`);

    // 每 5 分钟检查一次是否有新的/变更的调度任务
    setInterval(async () => {
      try {
        await refreshSchedules();
      } catch (err) {
        console.error('[Scheduler] 刷新调度任务失败:', err instanceof Error ? err.message : err);
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    console.error('[Scheduler] 启动调度器失败:', err instanceof Error ? err.message : err);
  }
}

/**
 * 注册一个 cron 任务
 */
function scheduleCronJob(schedule: ScheduleRow): boolean {
  // 先停止已有的同 ID 任务
  stopCronJob(schedule.id);

  if (!cron.validate(schedule.cron)) {
    console.error(`[Scheduler] 无效的 cron 表达式: ${schedule.cron} (schedule ${schedule.id})`);
    return false;
  }

  const task = cron.schedule(schedule.cron, async () => {
    await executeCronJob(schedule);
  }, {
    timezone: 'Asia/Shanghai',
  });

  activeJobs.set(schedule.id, task);
  activeCronExpressions.set(schedule.id, schedule.cron);
  console.log(`[Scheduler] 已注册任务 #${schedule.id}: rule=${schedule.rule_id}, cron="${schedule.cron}", maxBooks=${schedule.max_books}, maxPages=${schedule.max_pages}`);
  return true;
}

/**
 * 停止一个 cron 任务
 */
function stopCronJob(scheduleId: number): void {
  const existing = activeJobs.get(scheduleId);
  if (existing) {
    existing.stop();
    activeJobs.delete(scheduleId);
    activeCronExpressions.delete(scheduleId);
    console.log(`[Scheduler] 已停止任务 #${scheduleId}`);
  }
}

/**
 * 执行定时采集任务
 */
async function executeCronJob(schedule: ScheduleRow): Promise<void> {
  const startTime = Date.now();
  console.log(`[Scheduler] 开始执行任务 #${schedule.id} (rule=${schedule.rule_id})`);

  try {
    // 读取关联的采集规则
    const rules = await query(
      'SELECT * FROM collector_rules WHERE id = ? AND enabled = 1',
      [schedule.rule_id]
    ) as RuleRow[];

    if (rules.length === 0) {
      console.log(`[Scheduler] 任务 #${schedule.id}: 规则 ${schedule.rule_id} 不存在或未启用，跳过`);
      return;
    }

    const ruleRow = rules[0];

    // 执行批量采集
    const result = await runBatchCollector(ruleRow.id, {
      maxBooks: schedule.max_books || undefined,
      maxPages: schedule.max_pages || undefined,
      includeContent: false,
      resume: true,
      entryUrlConfigs: ruleRow.rule_json
        ? (JSON.parse(ruleRow.rule_json).entryUrlConfigs || [])
        : [],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Scheduler] 任务 #${schedule.id} 完成: 成功${result.successBooks}本, 失败${result.failedBooks}本, 跳过${result.skippedBooks}本, 耗时${elapsed}秒`);

    // 更新 last_run_at
    await execute(
      'UPDATE collector_schedules SET last_run_at = NOW() WHERE id = ?',
      [schedule.id]
    );

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Scheduler] 任务 #${schedule.id} 执行失败 (耗时${elapsed}秒):`, err instanceof Error ? err.message : err);

    // 仍然更新 last_run_at，标记已尝试执行
    await execute(
      'UPDATE collector_schedules SET last_run_at = NOW() WHERE id = ?',
      [schedule.id]
    );
  }
}

/**
 * 刷新调度任务（对比数据库中的配置与内存中的任务）
 */
async function refreshSchedules(): Promise<void> {
  const schedules = await query(
    'SELECT * FROM collector_schedules'
  ) as ScheduleRow[];

  const dbIds = new Set<number>();

  for (const schedule of schedules) {
    dbIds.add(schedule.id);

    if (schedule.enabled && schedule.cron && cron.validate(schedule.cron)) {
      // 检查是否已有此任务，且 cron 表达式是否变更
      const existingCron = activeCronExpressions.get(schedule.id);
      if (!activeJobs.has(schedule.id) || existingCron !== schedule.cron) {
        if (existingCron && existingCron !== schedule.cron) {
          console.log(`[Scheduler] 任务 #${schedule.id} cron 变更: "${existingCron}" -> "${schedule.cron}"，重新调度`);
        }
        scheduleCronJob(schedule);
      }
    } else {
      // 已禁用或无效，停止任务
      stopCronJob(schedule.id);
    }
  }

  // 停止数据库中已删除的任务
  for (const [id] of activeJobs) {
    if (!dbIds.has(id)) {
      stopCronJob(id);
    }
  }
}

/**
 * 获取当前活跃的调度任务数量（用于调试）
 */
export function getActiveScheduleCount(): number {
  return activeJobs.size;
}
