import type mysql from 'mysql2/promise';

export const name = '025_plugins_collector';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS plugins (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      plugin_key VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      description VARCHAR(500) DEFAULT '',
      enabled TINYINT(1) DEFAULT 1,
      config_json LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS collector_rules (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      entry_url VARCHAR(1000) NOT NULL,
      enabled TINYINT(1) DEFAULT 1,
      rule_json LONGTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_collector_rules_enabled (enabled),
      INDEX idx_collector_rules_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS collector_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      rule_id INT UNSIGNED DEFAULT NULL,
      status VARCHAR(50) NOT NULL,
      message VARCHAR(1000) DEFAULT '',
      book_name VARCHAR(500) DEFAULT '',
      chapter_count INT DEFAULT 0,
      content_count INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_collector_logs_rule_id (rule_id),
      INDEX idx_collector_logs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    INSERT INTO plugins (plugin_key, name, description, enabled, config_json)
    VALUES ('collector', '采集插件', '支持单本小说采集、规则导入导出和采集入库', 1, '{}')
    ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updated_at=NOW();
  `);
}
