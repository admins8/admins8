"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '026_baidu_push_plugin';
async function up(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS baidu_push_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      url_count INT DEFAULT 0,
      success_count INT DEFAULT 0,
      remain_count INT DEFAULT NULL,
      status VARCHAR(50) NOT NULL,
      message VARCHAR(1000) DEFAULT '',
      raw_json LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_baidu_push_logs_created (created_at),
      INDEX idx_baidu_push_logs_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    await db.query(`
    INSERT INTO plugins (plugin_key, name, description, enabled, config_json)
    VALUES ('baidu_push', '百度主动推送', '将 sitemap、新书和更新链接主动提交到百度搜索资源平台', 0, '{"site":"https://soumal.com","token":"","dailyLimit":100}')
    ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updated_at=NOW();
  `);
}
//# sourceMappingURL=026_baidu_push_plugin.js.map