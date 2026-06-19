"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '020_rss_sources';
async function up(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS rss_sources (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      source_url VARCHAR(500) NOT NULL,
      source_name VARCHAR(200) NOT NULL,
      source_group VARCHAR(200) DEFAULT NULL,
      source_icon VARCHAR(500) DEFAULT NULL,
      source_comment TEXT DEFAULT NULL,
      enabled TINYINT(1) DEFAULT 1,
      custom_order INT DEFAULT 0,
      article_style INT DEFAULT 0,
      single_url TINYINT(1) DEFAULT 0,
      enable_js TINYINT(1) DEFAULT 0,
      enabled_cookie_jar TINYINT(1) DEFAULT 1,
      header TEXT DEFAULT NULL,
      sort_url TEXT DEFAULT NULL,
      rule_articles TEXT DEFAULT NULL,
      rule_title TEXT DEFAULT NULL,
      rule_link TEXT DEFAULT NULL,
      rule_image TEXT DEFAULT NULL,
      rule_pub_date TEXT DEFAULT NULL,
      rule_content TEXT DEFAULT NULL,
      rule_next_page TEXT DEFAULT NULL,
      raw_json LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_rss_source_url (source_url),
      INDEX idx_rss_sources_group (source_group),
      INDEX idx_rss_sources_enabled (enabled),
      INDEX idx_rss_sources_order (custom_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
//# sourceMappingURL=020_rss_sources.js.map