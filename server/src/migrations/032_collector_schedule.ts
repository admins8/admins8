import type mysql from 'mysql2/promise';

export const name = '032_collector_schedule';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS collector_schedules (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      rule_id INT UNSIGNED NOT NULL,
      cron VARCHAR(100) NOT NULL,
      max_books INT DEFAULT 50,
      max_pages INT DEFAULT 10,
      enabled TINYINT(1) DEFAULT 1,
      last_run_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_collector_schedules_rule_id (rule_id),
      INDEX idx_collector_schedules_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
