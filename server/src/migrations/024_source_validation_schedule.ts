import type mysql from 'mysql2/promise';

export const name = '024_source_validation_schedule';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    INSERT IGNORE INTO site_config (config_key, config_value, description) VALUES
      ('source_validate_schedule_enabled', 'false', '是否启用书源定时验证'),
      ('source_validate_schedule_day', '1', '书源定时验证每月几号执行，范围 1-28'),
      ('source_validate_schedule_hour', '3', '书源定时验证小时，范围 0-23'),
      ('source_validate_schedule_minute', '0', '书源定时验证分钟，范围 0-59'),
      ('source_validate_schedule_keyword', '诡秘之主', '书源定时验证关键词，支持逗号分隔多个关键词'),
      ('source_validate_schedule_timeout_ms', '15000', '书源定时验证单源超时毫秒'),
      ('source_validate_schedule_concurrency', '5', '书源定时验证并发数'),
      ('source_validate_schedule_scope', 'enabled', '书源定时验证范围：enabled/all/failed'),
      ('source_validate_schedule_failure_action', 'none', '书源验证失败后的处理动作：none/disable/delete'),
      ('source_validate_last_run_key', '', '书源定时验证最近执行键'),
      ('source_validate_last_run_at', '', '书源定时验证最近执行时间'),
      ('source_validate_last_result', '', '书源定时验证最近执行结果')
  `);
}
